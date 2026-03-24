"""
Wellbeing module: pre-session check-in, mood analysis, reflections, parent auth + dashboard
Mounted on the main api_router in server.py
"""
import uuid
import jwt
import json
import asyncio
import re
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import List, Optional
import os

# These are injected from server.py when the router is mounted
db = None
EMERGENT_LLM_KEY = None
JWT_SECRET = None
pwd_context = None
logger = None


def inject_deps(_db, _key, _secret, _pwd_ctx, _logger):
    global db, EMERGENT_LLM_KEY, JWT_SECRET, pwd_context, logger
    db = _db
    EMERGENT_LLM_KEY = _key
    JWT_SECRET = _secret
    pwd_context = _pwd_ctx
    logger = _logger


wellbeing_router = APIRouter()


# ── Pydantic Models ──────────────────────────────────────────────────────────

class CheckinMessage(BaseModel):
    session_id: Optional[str] = None
    message: str

class ReflectionCreate(BaseModel):
    story_id: str
    mood_emoji: str
    what_i_liked: Optional[str] = ""
    what_i_learned: Optional[str] = ""

class ParentPinSet(BaseModel):
    pin: str  # 4-digit

class ParentPinVerify(BaseModel):
    pin: str

class SessionSettings(BaseModel):
    session_cap_minutes: Optional[int] = None
    session_cap_enabled: Optional[bool] = None
    child_name: Optional[str] = None
    parent_email: Optional[str] = None
    parent_phone: Optional[str] = None  # WhatsApp phone number for alerts


# ── Auth helpers ─────────────────────────────────────────────────────────────

async def get_current_user_wb(request: Request):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_parent_user(request: Request):
    """Requires a valid parent JWT (set is_parent=True in claim)"""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        if not payload.get("is_parent"):
            raise HTTPException(status_code=403, detail="Parent access required")
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def parse_json(text):
    if not text or not isinstance(text, str):
        return {}
    text = text.strip()
    m = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', text, re.DOTALL)
    if m:
        text = m.group(1).strip()
    idx = text.find('{')
    if idx != -1 and not text.startswith('{'):
        text = text[idx:]
    try:
        return json.loads(text)
    except Exception:
        return {}


# ── Session Settings ─────────────────────────────────────────────────────────

@wellbeing_router.get("/wellbeing/settings")
async def get_settings(user: dict = Depends(get_current_user_wb)):
    settings = await db.user_settings.find_one({"user_id": user["id"]}, {"_id": 0})
    if not settings:
        settings = {
            "user_id": user["id"],
            "session_cap_minutes": 25,
            "session_cap_enabled": True,
            "parent_pin_set": False,
            "child_name": user.get("name", ""),
            "parent_email": None,
            "parent_phone": None
        }
    settings.pop("parent_pin_hash", None)
    return settings


@wellbeing_router.put("/wellbeing/settings")
async def update_settings(data: SessionSettings, user: dict = Depends(get_current_user_wb)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No updates")
    await db.user_settings.update_one(
        {"user_id": user["id"]},
        {"$set": updates},
        upsert=True
    )
    return {"success": True}


# ── Pre-session Check-in ─────────────────────────────────────────────────────

LUNA_SYSTEM = """You are Luna, a warm and gentle companion for children ages 5-12.
Your job: have a caring, playful conversation to understand how the child is feeling today.
Rules:
- Ask ONE question at a time. Keep questions simple, warm, non-threatening.
- Use child-friendly language. No medical terms.
- After exactly 3 child responses, instead of asking another question, 
  respond with ONLY a JSON object (no other text):
  {
    "done": true,
    "mood_score": <1-10 where 1=very sad, 10=very happy>,
    "mood_tags": ["happy"|"sad"|"anxious"|"excited"|"tired"|"lonely"|"brave"|"curious"|"angry"],
    "detected_concerns": ["low_confidence"|"social_isolation"|"anxiety"|"sadness"|"aggression"|"none"],
    "summary": "<1 sentence warm summary of how the child seems today>",
    "story_suggestions": [
      {"theme": "<story theme>", "moral": "<moral>", "reason": "<why this helps>", "tone": "funny|adventure|bedtime|educational"},
      {"theme": "<story theme>", "moral": "<moral>", "reason": "<why this helps>", "tone": "funny|adventure|bedtime|educational"},
      {"theme": "<story theme>", "moral": "<moral>", "reason": "<why this helps>", "tone": "funny|adventure|bedtime|educational"}
    ]
  }
For questions 1-3, respond with ONLY the question text (no JSON)."""


@wellbeing_router.post("/wellbeing/checkin/start")
async def start_checkin(user: dict = Depends(get_current_user_wb)):
    """Start or resume today's check-in session"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    existing = await db.wellbeing_sessions.find_one(
        {"user_id": user["id"], "session_date": today},
        {"_id": 0}
    )
    if existing and existing.get("completed"):
        return {
            "session_id": existing["id"],
            "already_completed": True,
            "mood_score": existing.get("mood_score"),
            "mood_tags": existing.get("mood_tags", []),
            "story_suggestions": existing.get("story_suggestions", []),
            "summary": existing.get("summary", "")
        }

    if existing:
        return {
            "session_id": existing["id"],
            "already_completed": False,
            "messages": existing.get("messages", []),
            "exchange_count": existing.get("exchange_count", 0)
        }

    # New session — get Luna's first question using OpenAI directly
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    from openai import OpenAI

    session_id = str(uuid.uuid4())

    child_name = user.get("name", "friend").split()[0]
    user_prompt = f"The child's name is {child_name}. Start the conversation with your first warm question."

    client = OpenAI(api_key=EMERGENT_LLM_KEY)
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": LUNA_SYSTEM},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.4,
    )
    msg = completion.choices[0].message
    if isinstance(msg.content, str):
        first_q = msg.content.strip()
    else:
        first_q = "".join(
            part.text for part in msg.content if getattr(part, "type", "") == "text"
        ).strip()

    session_doc = {
        "id": session_id,
        "user_id": user["id"],
        "session_date": today,
        "messages": [{"role": "luna", "content": first_q}],
        "exchange_count": 0,
        "completed": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.wellbeing_sessions.insert_one(session_doc)
    return {"session_id": session_id, "already_completed": False, "messages": [{"role": "luna", "content": first_q}], "exchange_count": 0}


@wellbeing_router.post("/wellbeing/checkin/respond")
async def respond_to_checkin(data: CheckinMessage, user: dict = Depends(get_current_user_wb)):
    """Send a child's response to Luna"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    session = await db.wellbeing_sessions.find_one(
        {"user_id": user["id"], "session_date": today},
        {"_id": 0}
    )
    if not session:
        raise HTTPException(status_code=404, detail="No active check-in session")
    if session.get("completed"):
        return {"completed": True, "story_suggestions": session.get("story_suggestions", [])}

    messages = session.get("messages", [])
    exchange_count = session.get("exchange_count", 0)

    # Add child's message
    messages.append({"role": "child", "content": data.message})
    exchange_count += 1

    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    from openai import OpenAI

    # Reconstruct conversation context for LLM
    context = "\n".join(
        [f"{'Luna' if m['role']=='luna' else 'Child'}: {m['content']}" for m in messages]
    )

    prompt = f"Conversation so far:\n{context}\n\nThis was exchange #{exchange_count}. Continue as Luna."
    client = OpenAI(api_key=EMERGENT_LLM_KEY)
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": LUNA_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        temperature=0.4,
    )
    msg = completion.choices[0].message
    if isinstance(msg.content, str):
        luna_response = msg.content.strip()
    else:
        luna_response = "".join(
            part.text for part in msg.content if getattr(part, "type", "") == "text"
        ).strip()

    # Check if this is the final analysis JSON
    if exchange_count >= 3 or ('{' in luna_response and '"done"' in luna_response):
        analysis = parse_json(luna_response)
        if analysis.get("done"):
            messages.append({"role": "luna", "content": "Thank you for sharing with me today! I found some stories just for you."})
            await db.wellbeing_sessions.update_one(
                {"id": session["id"]},
                {"$set": {
                    "messages": messages,
                    "exchange_count": exchange_count,
                    "completed": True,
                    "mood_score": analysis.get("mood_score", 7),
                    "mood_tags": analysis.get("mood_tags", []),
                    "detected_concerns": analysis.get("detected_concerns", ["none"]),
                    "summary": analysis.get("summary", ""),
                    "story_suggestions": analysis.get("story_suggestions", []),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            logger.info(f"Check-in completed for user {user['id']}, mood_score={analysis.get('mood_score')}")
            return {
                "completed": True,
                "mood_score": analysis.get("mood_score"),
                "mood_tags": analysis.get("mood_tags", []),
                "summary": analysis.get("summary", ""),
                "story_suggestions": analysis.get("story_suggestions", [])
            }

    # Not done yet
    messages.append({"role": "luna", "content": luna_response})
    await db.wellbeing_sessions.update_one(
        {"id": session["id"]},
        {"$set": {"messages": messages, "exchange_count": exchange_count, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {
        "completed": False,
        "luna_message": luna_response,
        "exchange_count": exchange_count,
        "messages": messages
    }


@wellbeing_router.get("/wellbeing/checkin/today")
async def get_today_checkin(user: dict = Depends(get_current_user_wb)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    session = await db.wellbeing_sessions.find_one(
        {"user_id": user["id"], "session_date": today},
        {"_id": 0}
    )
    if not session:
        return {"has_checkin": False}
    session.pop("messages", None)  # don't send full messages in summary
    return {"has_checkin": True, **session}


# ── Reflections ───────────────────────────────────────────────────────────────

@wellbeing_router.post("/wellbeing/reflections")
async def save_reflection(data: ReflectionCreate, user: dict = Depends(get_current_user_wb)):
    reflection_id = str(uuid.uuid4())
    doc = {
        "id": reflection_id,
        "user_id": user["id"],
        "story_id": data.story_id,
        "mood_emoji": data.mood_emoji,
        "what_i_liked": data.what_i_liked,
        "what_i_learned": data.what_i_learned,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.reflections.insert_one(doc)
    return {"id": reflection_id, "success": True}


@wellbeing_router.get("/wellbeing/reflections")
async def get_reflections(user: dict = Depends(get_current_user_wb)):
    reflections = await db.reflections.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return reflections


# ── Parent PIN / Auth ─────────────────────────────────────────────────────────

@wellbeing_router.post("/parent/set-pin")
async def set_parent_pin(data: ParentPinSet, user: dict = Depends(get_current_user_wb)):
    if not data.pin.isdigit() or len(data.pin) != 4:
        raise HTTPException(status_code=400, detail="PIN must be exactly 4 digits")
    pin_hash = pwd_context.hash(data.pin)
    await db.user_settings.update_one(
        {"user_id": user["id"]},
        {"$set": {"parent_pin_hash": pin_hash, "parent_pin_set": True}},
        upsert=True
    )
    return {"success": True, "message": "Parent PIN set"}


@wellbeing_router.post("/parent/verify-pin")
async def verify_parent_pin(data: ParentPinVerify, user: dict = Depends(get_current_user_wb)):
    settings = await db.user_settings.find_one({"user_id": user["id"]}, {"_id": 0})
    if not settings or not settings.get("parent_pin_hash"):
        raise HTTPException(status_code=400, detail="No parent PIN set")
    if not pwd_context.verify(data.pin, settings["parent_pin_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect PIN")
    # Issue a short-lived parent JWT (2 hours)
    payload = {
        "user_id": user["id"],
        "is_parent": True,
        "exp": (datetime.now(timezone.utc) + timedelta(hours=2)).timestamp()
    }
    parent_token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    return {"parent_token": parent_token}


# ── Parent Dashboard ──────────────────────────────────────────────────────────

@wellbeing_router.get("/parent/dashboard")
async def get_parent_dashboard(user: dict = Depends(get_parent_user)):
    """Full analytics for parent — requires parent token"""
    user_id = user["id"]

    # Date ranges
    now = datetime.now(timezone.utc)
    week_ago = (now - timedelta(days=7)).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()

    # Wellbeing sessions last 30 days
    sessions = await db.wellbeing_sessions.find(
        {"user_id": user_id, "created_at": {"$gte": month_ago}, "completed": True},
        {"_id": 0}
    ).sort("created_at", -1).to_list(60)

    # Mood trend (last 7 days)
    mood_trend = []
    for i in range(6, -1, -1):
        day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        day_sessions = [s for s in sessions if s.get("session_date") == day]
        mood_score = day_sessions[0].get("mood_score") if day_sessions else None
        mood_trend.append({"date": day, "mood_score": mood_score, "label": (now - timedelta(days=i)).strftime("%a")})

    # Avg mood
    scored = [s["mood_score"] for s in sessions if s.get("mood_score")]
    avg_mood = round(sum(scored) / len(scored), 1) if scored else None

    # Detected concerns (last 7 days)
    recent_sessions = [s for s in sessions if s.get("created_at", "") >= week_ago]
    concern_map = {}
    for s in recent_sessions:
        for c in s.get("detected_concerns", []):
            if c != "none":
                concern_map[c] = concern_map.get(c, 0) + 1

    # Stories created
    stories_count = await db.stories.count_documents({"owner_id": user_id})
    stories_week = await db.stories.count_documents({"owner_id": user_id, "created_at": {"$gte": week_ago}})

    # Reflections
    reflections = await db.reflections.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(10)

    # Enrich reflections with story titles
    for r in reflections:
        story = await db.stories.find_one({"id": r.get("story_id")}, {"_id": 0, "title": 1})
        r["story_title"] = story["title"] if story else "Unknown Story"

    # Session settings
    settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})

    # Sessions this week
    checkins_week = len([s for s in sessions if s.get("created_at", "") >= week_ago])

    return {
        "user": {"name": user.get("name"), "email": user.get("email")},
        "summary": {
            "total_sessions_month": len(sessions),
            "checkins_this_week": checkins_week,
            "avg_mood_score": avg_mood,
            "stories_total": stories_count,
            "stories_this_week": stories_week,
        },
        "mood_trend": mood_trend,
        "detected_concerns": concern_map,
        "recent_reflections": reflections,
        "recent_sessions": [
            {
                "session_date": s["session_date"],
                "mood_score": s.get("mood_score"),
                "mood_tags": s.get("mood_tags", []),
                "summary": s.get("summary", ""),
                "detected_concerns": s.get("detected_concerns", [])
            }
            for s in sessions[:14]
        ],
        "settings": {
            "session_cap_minutes": settings.get("session_cap_minutes", 25) if settings else 25,
            "session_cap_enabled": settings.get("session_cap_enabled", True) if settings else True,
            "child_name": settings.get("child_name", user.get("name", "")) if settings else user.get("name", ""),
            "parent_pin_set": settings.get("parent_pin_set", False) if settings else False,
        }
    }
