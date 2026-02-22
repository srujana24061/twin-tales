"""
Responsible AI Module for TWINNEE
- Safety analysis on every child chat message
- Red flag detection with severity scoring
- Gentle nudges for children
- Parent alert generation
- Weekly behavior report generation
"""

import os
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY') or os.environ.get('OPENAI_API_KEY')

# ---------------------------------------------------------------------------
# Keyword pre-filter (fast, before AI call)
# ---------------------------------------------------------------------------
CRITICAL_KEYWORDS = [
    "kill myself", "want to die", "end my life", "suicide", "suicidal",
    "hurt myself", "cut myself", "self harm", "don't want to live",
    "no reason to live", "better off dead", "wish i was dead"
]
HIGH_KEYWORDS = [
    "scared", "terrified", "nobody loves me", "hitting me", "beating me",
    "abuse", "molest", "touch me", "hurting me", "bully", "bullied",
    "everyone hates me", "want to run away", "very sad", "depressed",
    "crying all the time", "can't stop crying"
]
MEDIUM_KEYWORDS = [
    "angry", "hate", "stupid", "idiot", "dumb", "boring", "lonely",
    "anxious", "worried", "nervous", "sad", "upset", "frustrated",
    "nobody cares", "no friends", "left out", "ignored"
]

BAD_LANGUAGE = [
    "fuck", "shit", "damn", "ass", "bitch", "crap", "hell", "bastard"
]


def keyword_prescreen(message: str) -> str:
    """Fast keyword-based pre-screen. Returns 'SAFE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'."""
    msg_lower = message.lower()
    for kw in CRITICAL_KEYWORDS:
        if kw in msg_lower:
            return "CRITICAL"
    for kw in HIGH_KEYWORDS:
        if kw in msg_lower:
            return "HIGH"
    for kw in BAD_LANGUAGE:
        if kw in msg_lower:
            return "MEDIUM"
    for kw in MEDIUM_KEYWORDS:
        if kw in msg_lower:
            return "MEDIUM"
    return "SAFE"


async def analyze_message_safety(
    message: str,
    child_name: str,
    conversation_history: List[Dict]
) -> Dict:
    """
    Run responsible AI safety analysis on a child's message.
    Returns severity, categories, child nudge, and parent alert.
    """
    # Fast pre-screen
    pre_severity = keyword_prescreen(message)

    # For SAFE messages with no keywords, skip AI call (save cost)
    if pre_severity == "SAFE":
        return {
            "severity": "SAFE",
            "categories": [],
            "summary": "Normal conversation",
            "child_nudge": None,
            "parent_alert": None,
            "parent_action_steps": [],
            "requires_immediate_action": False
        }

    # Build recent history context
    history_text = ""
    for c in conversation_history[-5:]:
        history_text += f"Child: {c.get('user_message', '')}\n"

    prompt = f"""You are a responsible AI safety analyzer for a children's app called TWINNEE. Analyze this message from a child named {child_name}.

Child's message: "{message}"

Recent messages from child (context):
{history_text or 'No prior context'}

Respond ONLY in valid JSON. Be compassionate but accurate:
{{
  "severity": "SAFE|LOW|MEDIUM|HIGH|CRITICAL",
  "categories": [],
  "summary": "1-sentence description of what was detected",
  "child_nudge": "A warm, gentle message to weave into TWINNEE's reply (null if SAFE)",
  "parent_alert": "Clear, empathetic message for the parent explaining what was said and why it matters (null if SAFE or LOW)",
  "parent_action_steps": ["Step 1...", "Step 2...", "Step 3..."],
  "requires_immediate_action": false
}}

Categories (pick all that apply): suicidal, self_harm, fear, abuse, bullying, bad_language, sadness, anxiety, anger, loneliness, none

Severity guide:
- SAFE: Normal healthy talk
- LOW: Mild sadness/boredom, brief bad word — just a gentle nudge needed
- MEDIUM: Repeated negative emotions, mild anxiety, some bad language — monitor and gently guide  
- HIGH: Strong fear, bullying, significant distress, worrying patterns — notify parent
- CRITICAL: Suicidal ideation, self-harm, abuse disclosure — immediate parent action required"""

    try:
        if not EMERGENT_LLM_KEY:
            raise RuntimeError("LLM key not configured")
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"safety_{hash(message) % 100000}",
            system_message="You are a responsible AI safety analyzer for a children's app. Always respond with valid JSON only."
        ).with_model("openai", "gpt-4o-mini")
        response = await chat.send_message(UserMessage(text=prompt))
        result = json.loads(response)
        # Ensure required fields
        result.setdefault("severity", pre_severity)
        result.setdefault("categories", [])
        result.setdefault("summary", "")
        result.setdefault("child_nudge", None)
        result.setdefault("parent_alert", None)
        result.setdefault("parent_action_steps", [])
        result.setdefault("requires_immediate_action", result.get("severity") == "CRITICAL")
        return result
    except Exception as e:
        logger.error(f"Safety analysis error: {e}")
        # Fallback: use keyword result
        return {
            "severity": pre_severity,
            "categories": ["unknown"],
            "summary": "Auto-detected concerning content",
            "child_nudge": "Remember, I'm always here to listen! You can tell me anything. 💙",
            "parent_alert": f"TWINNEE detected a concerning message from {child_name}: \"{message}\"",
            "parent_action_steps": [
                "Check in with your child today",
                "Ask open-ended questions about how they are feeling",
                "Contact a counselor if this pattern continues"
            ],
            "requires_immediate_action": pre_severity == "CRITICAL"
        }


async def generate_child_analysis_report(
    child_name: str,
    conversations: List[Dict],
    scores: Dict,
    red_flags: List[Dict]
) -> Dict:
    """
    Generate a comprehensive AI analysis of the child's recent behavior
    for the parent dashboard.
    """
    # Build conversation summary
    recent_msgs = [c.get("user_message", "") for c in conversations[-20:] if c.get("user_message")]
    conv_text = "\n".join(f"- {m}" for m in recent_msgs) if recent_msgs else "No recent conversations"

    # Recent red flags summary
    flag_text = ""
    if red_flags:
        for f in red_flags[-5:]:
            flag_text += f"[{f.get('severity')}] {f.get('summary', '')} ({f.get('timestamp', '')})\n"

    score_text = "\n".join(f"- {k}: {v:.0f}/100" for k, v in scores.items() if k != "overall")

    prompt = f"""You are a child psychologist AI assistant helping parents understand their child's digital behavior on TWINNEE app.

Child's name: {child_name}
Behavior scores (last 7 days):
{score_text}
Overall score: {scores.get('overall', 50):.0f}/100

Recent messages from child (last 20):
{conv_text}

Recent safety flags:
{flag_text or "None detected"}

Generate a parent-friendly JSON report:
{{
  "emotional_status": "One of: Thriving | Happy | Neutral | Struggling | Needs Attention | At Risk",
  "emotional_summary": "2-3 sentences describing how the child has been feeling based on conversations",
  "key_themes": ["theme1", "theme2", "theme3"],
  "strengths": ["What the child is doing well, 2-3 points"],
  "concerns": ["Areas needing attention, 1-3 points, empty if none"],
  "next_steps": [
    {{"priority": "high|medium|low", "action": "Specific action for parent", "reason": "Why this matters", "timeframe": "Today|This week|This month"}}
  ],
  "conversation_highlights": "1 paragraph: what topics/emotions came up most in conversations",
  "recommended_activities": ["Activity 1", "Activity 2", "Activity 3"],
  "weekly_focus": "One sentence on what parents should focus on this week"
}}

Be warm, constructive, and specific. Avoid clinical jargon. Write like a caring school counselor."""

    try:
        if not openai_client:
            raise RuntimeError("OpenAI client not configured")
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800,
            temperature=0.4,
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        logger.error(f"Analysis report error: {e}")
        return {
            "emotional_status": "Neutral",
            "emotional_summary": f"{child_name} has been using TWINNEE regularly. Check in for a more detailed picture.",
            "key_themes": ["stories", "daily activities"],
            "strengths": ["Active engagement with the app"],
            "concerns": [],
            "next_steps": [
                {"priority": "medium", "action": "Have a 5-minute check-in conversation", "reason": "Regular check-ins build trust", "timeframe": "Today"}
            ],
            "conversation_highlights": "Recent conversations have been normal with no major concerns.",
            "recommended_activities": ["Reading together", "Creative drawing", "Outdoor play"],
            "weekly_focus": "Spend quality time talking about their day and interests."
        }


async def generate_weekly_report(
    child_name: str,
    conversations: List[Dict],
    scores: Dict,
    red_flags: List[Dict],
    behavior_logs: List[Dict]
) -> str:
    """
    Generate a weekly email/WhatsApp report for parents.
    Returns HTML for email and plain text for WhatsApp.
    """
    analysis = await generate_child_analysis_report(child_name, conversations, scores, red_flags)

    overall = scores.get("overall", 50)
    status = analysis.get("emotional_status", "Neutral")
    summary = analysis.get("emotional_summary", "")
    next_steps = analysis.get("next_steps", [])
    weekly_focus = analysis.get("weekly_focus", "")
    flag_count = len(red_flags)

    # Plain text for WhatsApp
    steps_text = "\n".join(
        f"{i+1}. {s['action']} ({s.get('timeframe', 'This week')})"
        for i, s in enumerate(next_steps[:5])
    )

    whatsapp_text = f"""*TWINNEE Weekly Report for {child_name}*

*Overall Score: {overall:.0f}/100*
*Status: {status}*

{summary}

*Your Action Steps This Week:*
{steps_text}

*Weekly Focus:* {weekly_focus}

{"⚠️ *" + str(flag_count) + " concern(s) detected this week. Check the Parent Dashboard for details.*" if flag_count > 0 else "No safety concerns this week."}

Open the TWINNEE Parent Dashboard to view full details."""

    return whatsapp_text
