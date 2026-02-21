from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import asyncio
import base64
import re
import requests as http_requests
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from passlib.context import CryptContext
import jwt
from io import BytesIO

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
JWT_SECRET = os.environ.get('JWT_SECRET')

# Initialize external services
from services import S3Service, MiniMaxService
s3_service = S3Service()
minimax_service = MiniMaxService()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ==================== PYDANTIC MODELS ====================

class UserRegister(BaseModel):
    email: str
    password: str
    name: str

class UserLogin(BaseModel):
    email: str
    password: str

class CharacterCreate(BaseModel):
    name: str
    role: str = "hero"
    description: str = ""
    personality_traits: List[str] = []
    speaking_style: str = ""
    voice_style: str = ""
    is_imaginary: bool = False

class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    description: Optional[str] = None
    personality_traits: Optional[List[str]] = None
    speaking_style: Optional[str] = None
    voice_style: Optional[str] = None
    is_imaginary: Optional[bool] = None

class StoryCreate(BaseModel):
    title: str
    story_type: str = "original"
    tone: str = "funny"
    visual_style: str = "cartoon"
    video_style: str = "narrated"
    moral_theme: str = ""
    story_length: str = "medium"
    character_ids: List[str] = []
    user_topic: str = ""
    user_full_story: str = ""

class SceneUpdate(BaseModel):
    scene_text: Optional[str] = None
    narration_text: Optional[str] = None
    dialogue_text: Optional[str] = None
    image_prompt: Optional[str] = None
    video_prompt: Optional[str] = None


# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_token(user_id: str) -> str:
    payload = {"user_id": user_id, "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def get_current_user(request: Request):
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

def parse_json_response(text):
    text = text.strip()
    json_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', text, re.DOTALL)
    if json_match:
        text = json_match.group(1).strip()
    if not text.startswith('{') and not text.startswith('['):
        idx = text.find('{')
        if idx != -1:
            text = text[idx:]
    return json.loads(text)


# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register")
async def register(data: UserRegister):
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": data.email,
        "name": data.name,
        "password_hash": hash_password(data.password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    token = create_token(user_id)
    return {"token": token, "user": {"id": user_id, "email": data.email, "name": data.name}}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"]}}

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {"id": user["id"], "email": user["email"], "name": user["name"]}


# ==================== CHARACTER ROUTES ====================

@api_router.post("/characters")
async def create_character(data: CharacterCreate, user: dict = Depends(get_current_user)):
    char_id = str(uuid.uuid4())
    char_doc = {
        "id": char_id,
        "owner_id": user["id"],
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.characters.insert_one(char_doc)
    char_doc.pop("_id", None)
    return char_doc

@api_router.get("/characters")
async def list_characters(user: dict = Depends(get_current_user)):
    chars = await db.characters.find({"owner_id": user["id"]}, {"_id": 0}).to_list(100)
    return chars

@api_router.get("/characters/{char_id}")
async def get_character(char_id: str, user: dict = Depends(get_current_user)):
    char = await db.characters.find_one({"id": char_id, "owner_id": user["id"]}, {"_id": 0})
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    return char

@api_router.put("/characters/{char_id}")
async def update_character(char_id: str, data: CharacterUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.characters.update_one(
        {"id": char_id, "owner_id": user["id"]},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Character not found")
    return await db.characters.find_one({"id": char_id}, {"_id": 0})

@api_router.delete("/characters/{char_id}")
async def delete_character(char_id: str, user: dict = Depends(get_current_user)):
    result = await db.characters.delete_one({"id": char_id, "owner_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Character not found")
    return {"message": "Character deleted"}


# ==================== STORY ROUTES ====================

@api_router.post("/stories")
async def create_story(data: StoryCreate, user: dict = Depends(get_current_user)):
    story_id = str(uuid.uuid4())
    story_doc = {
        "id": story_id,
        "owner_id": user["id"],
        **data.model_dump(),
        "status": "draft",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.stories.insert_one(story_doc)
    story_doc.pop("_id", None)
    return story_doc

@api_router.get("/stories")
async def list_stories(user: dict = Depends(get_current_user)):
    stories = await db.stories.find({"owner_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for s in stories:
        s["scene_count"] = await db.scenes.count_documents({"story_id": s["id"]})
    return stories

@api_router.get("/stories/{story_id}")
async def get_story(story_id: str, user: dict = Depends(get_current_user)):
    story = await db.stories.find_one({"id": story_id, "owner_id": user["id"]}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    story["scenes"] = await db.scenes.find({"story_id": story_id}, {"_id": 0}).sort("scene_number", 1).to_list(100)
    story["scene_count"] = len(story["scenes"])
    characters = []
    for cid in story.get("character_ids", []):
        c = await db.characters.find_one({"id": cid}, {"_id": 0})
        if c:
            characters.append(c)
    story["characters"] = characters
    return story

@api_router.delete("/stories/{story_id}")
async def delete_story(story_id: str, user: dict = Depends(get_current_user)):
    result = await db.stories.delete_one({"id": story_id, "owner_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Story not found")
    await db.scenes.delete_many({"story_id": story_id})
    await db.generation_jobs.delete_many({"story_id": story_id})
    return {"message": "Story deleted"}


# ==================== SCENE ROUTES ====================

@api_router.get("/stories/{story_id}/scenes")
async def get_scenes(story_id: str, user: dict = Depends(get_current_user)):
    story = await db.stories.find_one({"id": story_id, "owner_id": user["id"]})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    scenes = await db.scenes.find({"story_id": story_id}, {"_id": 0}).sort("scene_number", 1).to_list(100)
    return scenes

@api_router.put("/stories/{story_id}/scenes/{scene_id}")
async def update_scene(story_id: str, scene_id: str, data: SceneUpdate, user: dict = Depends(get_current_user)):
    story = await db.stories.find_one({"id": story_id, "owner_id": user["id"]})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.scenes.update_one({"id": scene_id, "story_id": story_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Scene not found")
    return await db.scenes.find_one({"id": scene_id}, {"_id": 0})

@api_router.post("/stories/{story_id}/scenes/{scene_id}/regenerate-image")
async def regenerate_scene_image(story_id: str, scene_id: str, user: dict = Depends(get_current_user)):
    story = await db.stories.find_one({"id": story_id, "owner_id": user["id"]}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    scene = await db.scenes.find_one({"id": scene_id, "story_id": story_id}, {"_id": 0})
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    job_id = str(uuid.uuid4())
    job_doc = {
        "id": job_id, "story_id": story_id, "user_id": user["id"],
        "job_type": "image_regen", "status": "pending", "progress": 0,
        "error_message": None, "result_url": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.generation_jobs.insert_one(job_doc)
    asyncio.create_task(run_image_regeneration(story, scene, job_id))
    return {"job_id": job_id, "status": "pending"}


# ==================== GENERATION ENGINE ====================

async def run_story_generation(story_id: str, job_id: str):
    try:
        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "running", "progress": 5, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

        story = await db.stories.find_one({"id": story_id}, {"_id": 0})
        characters = []
        for cid in story.get("character_ids", []):
            c = await db.characters.find_one({"id": cid}, {"_id": 0})
            if c:
                characters.append(c)

        length_map = {"short": 3, "medium": 5, "long": 8}
        num_scenes = length_map.get(story.get("story_length", "medium"), 5)

        char_descriptions = ""
        for c in characters:
            traits = ", ".join(c.get("personality_traits", []))
            char_descriptions += f"- {c['name']}: Role={c['role']}, Traits={traits}, Speaking style={c.get('speaking_style', 'normal')}\n"

        if not char_descriptions:
            char_descriptions = "- Create appropriate original characters for the story\n"

        if story.get("user_full_story"):
            prompt = f"""You are an expert children's story editor. Break this story into exactly {num_scenes} visual scenes.

Story to adapt:
{story['user_full_story']}

Characters: 
{char_descriptions}

Visual style: {story['visual_style']} illustration
Tone: {story['tone']}
Moral theme: {story.get('moral_theme', 'kindness and friendship')}

Return ONLY valid JSON:
{{"title": "{story['title']}", "scenes": [{{"scene_number": 1, "scene_title": "Title", "scene_text": "5-7 sentences", "narration_text": "Narrator version", "dialogue_text": "Character dialogue", "image_prompt": "Detailed {story['visual_style']} illustration description with characters, setting, colors, mood", "video_prompt": "Cinematic description", "duration_seconds": 8}}]}}"""
        else:
            topic = story.get("user_topic", story["title"])
            prompt = f"""You are an expert children's story writer for ages 3-10. Create a {story['tone']} story.

Topic: {topic}
Title: {story['title']}

Characters:
{char_descriptions}

Requirements:
- Create exactly {num_scenes} scenes
- Teach about: {story.get('moral_theme', 'kindness and friendship')}
- 100% child-safe, no violence or stereotypes
- Visual style: {story['visual_style']}

Return ONLY valid JSON:
{{"title": "{story['title']}", "scenes": [{{"scene_number": 1, "scene_title": "Title", "scene_text": "5-7 sentences of story", "narration_text": "Warm narration for reading aloud", "dialogue_text": "Character dialogue", "image_prompt": "Detailed {story['visual_style']} illustration of [scene description with character appearances, setting, colors, mood, lighting]", "video_prompt": "Cinematic animation description", "duration_seconds": 8}}]}}"""

        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"story-gen-{story_id}-{uuid.uuid4().hex[:8]}",
            system_message="You are a children's story writer. Return ONLY valid JSON. No markdown."
        ).with_model("openai", "gpt-5.2")

        logger.info(f"Generating story text for {story_id}")
        response = await chat.send_message(UserMessage(text=prompt))
        story_data = parse_json_response(response)

        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"progress": 25, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

        # Delete existing scenes
        await db.scenes.delete_many({"story_id": story_id})

        scenes_list = story_data.get("scenes", [])
        for scene in scenes_list:
            scene_doc = {
                "id": str(uuid.uuid4()),
                "story_id": story_id,
                "scene_number": scene.get("scene_number", 1),
                "scene_title": scene.get("scene_title", ""),
                "scene_text": scene.get("scene_text", ""),
                "narration_text": scene.get("narration_text", ""),
                "dialogue_text": scene.get("dialogue_text", ""),
                "image_prompt": scene.get("image_prompt", ""),
                "video_prompt": scene.get("video_prompt", ""),
                "duration_seconds": scene.get("duration_seconds", 8),
                "image_url": None,
                "safety_checked": False,
                "safety_flagged": False,
                "safety_issues": [],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.scenes.insert_one(scene_doc)

        logger.info(f"Created {len(scenes_list)} scenes for story {story_id}")

        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"progress": 30, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

        # Run safety checks
        await run_safety_checks(story_id, job_id)

        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"progress": 40, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

        # Generate images for each scene
        scenes = await db.scenes.find({"story_id": story_id}, {"_id": 0}).sort("scene_number", 1).to_list(100)
        total = len(scenes)

        story_fresh = await db.stories.find_one({"id": story_id}, {"_id": 0})
        user_id = story_fresh.get("owner_id", "unknown")

        for i, scene in enumerate(scenes):
            if scene.get("safety_flagged"):
                logger.info(f"Skipping flagged scene {scene['id']}")
                continue
            try:
                img_prompt = f"{scene['image_prompt']}. Style: {story['visual_style']} illustration, child-friendly, vibrant colors, safe for children."
                if len(img_prompt) > 1500:
                    img_prompt = img_prompt[:1500]

                logger.info(f"Generating image for scene {i+1}/{total} via MiniMax")
                results = await minimax_service.generate_image(img_prompt, aspect_ratio="16:9")

                if results:
                    result_type, result_data = results[0]
                    s3_key = f"users/{user_id}/stories/{story_id}/scenes/{scene['scene_number']}/image.png"

                    if result_type == "url":
                        s3_url = await s3_service.upload_from_url(s3_key, result_data, 'image/png')
                    else:
                        img_bytes = base64.b64decode(result_data)
                        s3_url = await s3_service.upload(s3_key, img_bytes, 'image/png')

                    asset_id = str(uuid.uuid4())
                    await db.media_assets.insert_one({
                        "id": asset_id, "type": "image", "format": "png",
                        "s3_key": s3_key, "s3_url": s3_url,
                        "scene_id": scene["id"], "story_id": story_id,
                        "provider": "minimax",
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })
                    await db.scenes.update_one(
                        {"id": scene["id"]},
                        {"$set": {"image_url": f"/api/media/{asset_id}"}}
                    )
                    logger.info(f"Image uploaded to S3 for scene {i+1}")
            except Exception as e:
                logger.error(f"Image generation failed for scene {scene['id']}: {e}")

            progress = 40 + int((i + 1) / total * 55)
            await db.generation_jobs.update_one(
                {"id": job_id},
                {"$set": {"progress": progress, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )

        await db.stories.update_one({"id": story_id}, {"$set": {"status": "generated"}})
        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "completed", "progress": 100, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        logger.info(f"Story generation completed for {story_id}")

    except Exception as e:
        logger.error(f"Story generation failed: {e}")
        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "failed", "error_message": str(e), "updated_at": datetime.now(timezone.utc).isoformat()}}
        )


async def run_safety_checks(story_id: str, job_id: str):
    try:
        scenes = await db.scenes.find({"story_id": story_id}, {"_id": 0}).to_list(100)
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        for scene in scenes:
            try:
                chat = LlmChat(
                    api_key=EMERGENT_LLM_KEY,
                    session_id=f"safety-{scene['id']}-{uuid.uuid4().hex[:8]}",
                    system_message="You are a child safety content moderator. Analyze content for children ages 3-10. Return ONLY JSON."
                ).with_model("openai", "gpt-5.2")

                check_prompt = f"""Analyze this children's story content:
Scene Text: {scene['scene_text']}
Image Prompt: {scene['image_prompt']}

Check for: violence, adult themes, stereotypes, age-inappropriate language.
Return JSON: {{"safe": true, "issues": [], "severity": "none"}}"""

                resp = await chat.send_message(UserMessage(text=check_prompt))
                result = parse_json_response(resp)

                is_safe = result.get("safe", True)
                issues = result.get("issues", [])

                await db.scenes.update_one(
                    {"id": scene["id"]},
                    {"$set": {
                        "safety_checked": True,
                        "safety_flagged": not is_safe,
                        "safety_issues": issues
                    }}
                )

                await db.ai_safety_checks.insert_one({
                    "id": str(uuid.uuid4()),
                    "scene_id": scene["id"],
                    "story_id": story_id,
                    "flagged": not is_safe,
                    "issues": issues,
                    "severity": result.get("severity", "none"),
                    "model_used": "gpt-5.2",
                    "checked_at": datetime.now(timezone.utc).isoformat()
                })
            except Exception as e:
                logger.error(f"Safety check failed for scene {scene['id']}: {e}")
                await db.scenes.update_one(
                    {"id": scene["id"]},
                    {"$set": {"safety_checked": True, "safety_flagged": False}}
                )
    except Exception as e:
        logger.error(f"Safety checks failed: {e}")


async def run_image_regeneration(story: dict, scene: dict, job_id: str):
    try:
        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "running", "progress": 10, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

        img_prompt = f"{scene['image_prompt']}. Style: {story['visual_style']} illustration, child-friendly, vibrant colors."
        if len(img_prompt) > 1500:
            img_prompt = img_prompt[:1500]

        results = await minimax_service.generate_image(img_prompt, aspect_ratio="16:9")

        if results:
            result_type, result_data = results[0]
            user_id = story.get("owner_id", "unknown")
            s3_key = f"users/{user_id}/stories/{story['id']}/scenes/{scene['scene_number']}/image_{uuid.uuid4().hex[:8]}.png"

            if result_type == "url":
                s3_url = await s3_service.upload_from_url(s3_key, result_data, 'image/png')
            else:
                img_bytes = base64.b64decode(result_data)
                s3_url = await s3_service.upload(s3_key, img_bytes, 'image/png')

            asset_id = str(uuid.uuid4())
            await db.media_assets.insert_one({
                "id": asset_id, "type": "image", "format": "png",
                "s3_key": s3_key, "s3_url": s3_url,
                "scene_id": scene["id"], "story_id": story["id"],
                "provider": "minimax",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            await db.scenes.update_one(
                {"id": scene["id"]},
                {"$set": {"image_url": f"/api/media/{asset_id}"}}
            )

        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "completed", "progress": 100, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    except Exception as e:
        logger.error(f"Image regen failed: {e}")
        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "failed", "error_message": str(e), "updated_at": datetime.now(timezone.utc).isoformat()}}
        )


async def run_pdf_generation(story_id: str, job_id: str):
    try:
        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "running", "progress": 10, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

        story = await db.stories.find_one({"id": story_id}, {"_id": 0})
        scenes = await db.scenes.find({"story_id": story_id}, {"_id": 0}).sort("scene_number", 1).to_list(100)

        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas as pdf_canvas
        from reportlab.lib.utils import ImageReader
        from reportlab.lib.colors import HexColor

        buffer = BytesIO()
        c = pdf_canvas.Canvas(buffer, pagesize=letter)
        width, height = letter

        # Title page
        c.setFillColor(HexColor("#6366F1"))
        c.rect(0, 0, width, height, fill=1)
        c.setFillColor(HexColor("#FFFFFF"))
        c.setFont("Helvetica-Bold", 36)

        title = story.get("title", "My Story")
        title_lines = []
        words = title.split()
        line = ""
        for w in words:
            if len(line + w) > 20:
                title_lines.append(line.strip())
                line = w + " "
            else:
                line += w + " "
        if line:
            title_lines.append(line.strip())

        y_start = height / 2 + 30 * len(title_lines) / 2
        for i, tl in enumerate(title_lines):
            c.drawCentredString(width / 2, y_start - i * 40, tl)

        c.setFont("Helvetica", 16)
        c.drawCentredString(width / 2, y_start - len(title_lines) * 40 - 30, "A StoryCraft AI Story")
        c.setFont("Helvetica", 12)
        c.drawCentredString(width / 2, 50, f"Created with AI - {story.get('tone', '').title()} Theme")
        c.showPage()

        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"progress": 20, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

        # Scene pages
        for idx, scene in enumerate(scenes):
            c.setFillColor(HexColor("#FDFBF7"))
            c.rect(0, 0, width, height, fill=1)

            # Scene title
            c.setFillColor(HexColor("#6366F1"))
            c.setFont("Helvetica-Bold", 18)
            c.drawString(50, height - 50, f"Scene {scene['scene_number']}: {scene.get('scene_title', '')}")

            # Try to add image
            img_y_bottom = height - 380
            if scene.get("image_url"):
                try:
                    asset_id_ref = scene["image_url"].split("/")[-1]
                    asset = await db.media_assets.find_one({"id": asset_id_ref}, {"_id": 0})
                    if asset:
                        img_data = None
                        if asset.get("s3_url"):
                            resp = await asyncio.to_thread(http_requests.get, asset["s3_url"], timeout=30)
                            if resp.status_code == 200:
                                img_data = resp.content
                        elif asset.get("data"):
                            img_data = base64.b64decode(asset["data"])
                        if img_data:
                            img_buffer = BytesIO(img_data)
                            img = ImageReader(img_buffer)
                            c.drawImage(img, 50, img_y_bottom, width=width - 100, height=300, preserveAspectRatio=True)
                except Exception as e:
                    logger.error(f"PDF image error: {e}")

            # Scene text
            c.setFillColor(HexColor("#1E293B"))
            c.setFont("Helvetica", 12)
            text = scene.get("scene_text", "")
            y = img_y_bottom - 30
            words = text.split()
            line = ""
            for w in words:
                if len(line + w) > 80:
                    c.drawString(50, y, line.strip())
                    line = w + " "
                    y -= 18
                    if y < 50:
                        break
                else:
                    line += w + " "
            if line and y >= 50:
                c.drawString(50, y, line.strip())

            c.showPage()

            progress = 20 + int((idx + 1) / len(scenes) * 70)
            await db.generation_jobs.update_one(
                {"id": job_id},
                {"$set": {"progress": progress, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )

        c.save()

        pdf_b64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        asset_id = str(uuid.uuid4())

        # Upload PDF to S3
        user_id_for_pdf = (await db.stories.find_one({"id": story_id}, {"_id": 0, "owner_id": 1})).get("owner_id", "unknown")
        s3_key = f"users/{user_id_for_pdf}/stories/{story_id}/pdf/story_{asset_id[:8]}.pdf"
        s3_url = await s3_service.upload(s3_key, buffer.getvalue(), 'application/pdf')

        await db.media_assets.insert_one({
            "id": asset_id, "type": "pdf", "format": "pdf",
            "s3_key": s3_key, "s3_url": s3_url, "story_id": story_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {
                "status": "completed", "progress": 100,
                "result_url": f"/api/media/{asset_id}",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        logger.info(f"PDF generated for story {story_id}")

    except Exception as e:
        logger.error(f"PDF generation failed: {e}")
        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "failed", "error_message": str(e), "updated_at": datetime.now(timezone.utc).isoformat()}}
        )


# ==================== GENERATION ROUTES ====================

@api_router.post("/stories/{story_id}/generate")
async def generate_story(story_id: str, user: dict = Depends(get_current_user)):
    story = await db.stories.find_one({"id": story_id, "owner_id": user["id"]})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    job_id = str(uuid.uuid4())
    job_doc = {
        "id": job_id, "story_id": story_id, "user_id": user["id"],
        "job_type": "story", "status": "pending", "progress": 0,
        "error_message": None, "result_url": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.generation_jobs.insert_one(job_doc)
    await db.stories.update_one({"id": story_id}, {"$set": {"status": "generating"}})
    asyncio.create_task(run_story_generation(story_id, job_id))
    return {"job_id": job_id, "status": "pending"}

@api_router.post("/stories/{story_id}/generate-pdf")
async def generate_pdf(story_id: str, user: dict = Depends(get_current_user)):
    story = await db.stories.find_one({"id": story_id, "owner_id": user["id"]})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    job_id = str(uuid.uuid4())
    job_doc = {
        "id": job_id, "story_id": story_id, "user_id": user["id"],
        "job_type": "pdf", "status": "pending", "progress": 0,
        "error_message": None, "result_url": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.generation_jobs.insert_one(job_doc)
    asyncio.create_task(run_pdf_generation(story_id, job_id))
    return {"job_id": job_id, "status": "pending"}


# ==================== JOB ROUTES ====================

@api_router.get("/jobs/{job_id}")
async def get_job(job_id: str, user: dict = Depends(get_current_user)):
    job = await db.generation_jobs.find_one({"id": job_id, "user_id": user["id"]}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@api_router.get("/jobs")
async def list_jobs(user: dict = Depends(get_current_user)):
    jobs = await db.generation_jobs.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return jobs


# ==================== MEDIA ROUTES ====================

@api_router.get("/media/{asset_id}")
async def get_media(asset_id: str):
    asset = await db.media_assets.find_one({"id": asset_id}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Media not found")

    data = base64.b64decode(asset["data"])
    media_type = asset.get("type", "image")
    fmt = asset.get("format", "png")

    if media_type == "pdf":
        return Response(
            content=data,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=story_{asset_id[:8]}.pdf"}
        )
    return Response(content=data, media_type=f"image/{fmt}")


# ==================== DASHBOARD STATS ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(user: dict = Depends(get_current_user)):
    story_count = await db.stories.count_documents({"owner_id": user["id"]})
    char_count = await db.characters.count_documents({"owner_id": user["id"]})
    job_count = await db.generation_jobs.count_documents({"user_id": user["id"]})
    completed_jobs = await db.generation_jobs.count_documents({"user_id": user["id"], "status": "completed"})
    return {
        "stories": story_count,
        "characters": char_count,
        "total_jobs": job_count,
        "completed_jobs": completed_jobs
    }


# ==================== APP SETUP ====================

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
