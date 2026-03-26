from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from celery import Celery
import os
import logging
import json
import asyncio
import base64
import re
import requests as http_requests
import requests
import tempfile
import shutil
import subprocess
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import jwt
from io import BytesIO
import numpy as np
from PIL import Image
import imageio  # type: ignore[import-not-found]
from openai import OpenAI

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env', override=True)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
JWT_SECRET = os.environ.get('JWT_SECRET')
CELERY_BROKER_URL = os.environ["CELERY_BROKER_URL"]
CELERY_RESULT_BACKEND = os.environ["CELERY_RESULT_BACKEND"]
CELERY_TASK_ALWAYS_EAGER = os.environ["CELERY_TASK_ALWAYS_EAGER"].lower() == "true"

celery_app = Celery("storycraft", broker=CELERY_BROKER_URL, backend=CELERY_RESULT_BACKEND)
celery_app.conf.update(task_always_eager=CELERY_TASK_ALWAYS_EAGER, task_eager_propagates=True)

# Initialize external services
from services import (
    S3Service,
    MiniMaxService,
    ElevenLabsService,
    EdgeTTSService,
    GeminiImageService,
    FotorService,
)
from notifications import notify_video_complete
s3_service = S3Service()
minimax_service = MiniMaxService()
image_gen_service = GeminiImageService()
elevenlabs_service = ElevenLabsService()
edge_tts_service = EdgeTTSService()
fotor_service = FotorService()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI()

cors_origins_raw = os.environ.get("CORS_ORIGINS")
cors_origins = [o.strip() for o in cors_origins_raw.split(",") if o.strip()] if cors_origins_raw else [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ==================== PYDANTIC MODELS ====================

class UserRegister(BaseModel):
    email: str
    password: str
    name: str
    phone: Optional[str] = None  # Added phone number field

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
    image_provider: str = "nano_banana"
    image_aspect_ratio: str = "16:9"
    character_ids: List[str] = []
    user_topic: str = ""
    user_full_story: str = ""

class SceneUpdate(BaseModel):
    scene_text: Optional[str] = None
    narration_text: Optional[str] = None
    dialogue_text: Optional[str] = None
    image_prompt: Optional[str] = None
    video_prompt: Optional[str] = None
    duration_seconds: Optional[int] = None
    trim_start_seconds: Optional[float] = None
    trim_end_seconds: Optional[float] = None
    transition_type: Optional[str] = None
    include_in_video: Optional[bool] = None

class SceneGridUpdate(BaseModel):
    scene_text: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None

class ImageRegenRequest(BaseModel):
    provider: str = "nano_banana"


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
    if not text or not isinstance(text, str):
        return {}
    text = text.strip()
    json_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', text, re.DOTALL)
    if json_match:
        text = json_match.group(1).strip()
    if not text.startswith('{') and not text.startswith('['):
        idx = text.find('{')
        if idx != -1:
            text = text[idx:]
    return json.loads(text)


def enqueue_task(task, *args, fallback_coro=None):
    if CELERY_TASK_ALWAYS_EAGER and fallback_coro:
        asyncio.create_task(fallback_coro(*args))
    else:
        task.delay(*args)


def run_celery_async(coro):
    async def _runner():
        local_client = AsyncIOMotorClient(mongo_url)
        local_db = local_client[os.environ['DB_NAME']]
        original_db = globals().get("db")
        globals()["db"] = local_db
        try:
            await coro
        finally:
            globals()["db"] = original_db
            local_client.close()
    asyncio.run(_runner())


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
        "phone": data.phone,  # Store phone number
        "password_hash": hash_password(data.password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    token = create_token(user_id)
    return {"token": token, "user": {"id": user_id, "email": data.email, "name": data.name, "phone": data.phone}}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"], "phone": user.get("phone")}}

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {"id": user["id"], "email": user["email"], "name": user["name"], "phone": user.get("phone")}


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


@api_router.post("/characters/{char_id}/upload-photo")
async def upload_character_photo(char_id: str, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    char = await db.characters.find_one({"id": char_id, "owner_id": user["id"]})
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")

    allowed = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WEBP images allowed")

    ext = file.content_type.split("/")[-1]
    if ext == "jpeg":
        ext = "jpg"
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    asset_id = str(uuid.uuid4())
    s3_key = f"users/{user['id']}/characters/{char_id}/photo.{ext}"
    s3_url = None

    # Try S3 upload first, fall back to MongoDB
    try:
        s3_url = await s3_service.upload(s3_key, contents, file.content_type)
        await db.media_assets.insert_one({
            "id": asset_id, "type": "image", "format": ext,
            "s3_key": s3_key, "s3_url": s3_url,
            "character_id": char_id, "owner_id": user["id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Character photo uploaded to S3: {s3_key}")
    except Exception as e:
        logger.warning(f"S3 upload failed, using MongoDB fallback: {e}")
        image_b64 = base64.b64encode(contents).decode('utf-8')
        await db.media_assets.insert_one({
            "id": asset_id, "type": "image", "format": ext,
            "data": image_b64,
            "character_id": char_id, "owner_id": user["id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Character photo stored in MongoDB: {asset_id}")

    # Store direct S3 URL if available, otherwise fall back to proxied URL
    reference_image_url = s3_url if s3_url else f"/api/media/{asset_id}"
    await db.characters.update_one(
        {"id": char_id},
        {"$set": {
            "reference_image": reference_image_url,
            "reference_image_asset_id": asset_id,
            "reference_image_s3_key": s3_key if s3_url else None
        }}
    )

    updated = await db.characters.find_one({"id": char_id}, {"_id": 0})
    return updated


# ==================== GEMINI IMAGE STYLE CONVERSION ROUTES ====================

@api_router.get("/image-styles/templates")
async def get_image_style_templates(user: dict = Depends(get_current_user)):
    """Get available image style conversion templates"""
    templates = [
        {"id": "cartoon", "name": "Cartoon (Disney Style)", "description": "Colorful 3D animation style"},
        {"id": "anime", "name": "Anime (Studio Ghibli)", "description": "Japanese anime with vibrant colors"},
        {"id": "pixar", "name": "Pixar 3D", "description": "Pixar-style 3D character"},
        {"id": "toy", "name": "Toy Figurine", "description": "3D plastic toy with bright colors"},
        {"id": "comic", "name": "Comic Book", "description": "Bold outlines and halftone shading"},
        {"id": "watercolor", "name": "Watercolor Art", "description": "Soft watercolor painting"},
        {"id": "sketch", "name": "Pencil Sketch", "description": "Detailed pencil drawing"},
        {"id": "realistic", "name": "Realistic Photo", "description": "Hyper-realistic 8k photograph"}
    ]
    return {"templates": templates}


@api_router.post("/image-styles/convert")
async def convert_image_style(
    request: Request,
    user: dict = Depends(get_current_user)
):
    """Convert image to different artistic style using Gemini"""
    try:
        body = await request.json()
        image_url = body.get("image_url")
        style = body.get("style", "cartoon")

        if not image_url:
            raise HTTPException(status_code=400, detail="image_url required")

        # Convert relative URLs to absolute
        if image_url.startswith("/api/media/"):
            # For media assets, we need to get the actual URL
            asset_id = image_url.split("/")[-1]
            asset = await db.media_assets.find_one({"id": asset_id}, {"_id": 0})
            if asset and asset.get("s3_key"):
                image_url = s3_service.get_signed_url(asset["s3_key"], expires=3600)
            elif asset and asset.get("s3_url"):
                image_url = asset["s3_url"]
            elif asset and asset.get("data"):
                # Base64 data - convert to data URL
                image_url = f"data:image/{asset.get('format', 'png')};base64,{asset['data']}"

        logger.info(f"Converting image to {style} style")
        result = await image_gen_service.convert_image_style(image_url, style)

        return {
            "status": "completed",
            "style": style,
            "result_base64": result["image_base64"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Image style conversion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/characters/{char_id}/save-styled-image")
async def save_styled_character_image(
    char_id: str,
    request: Request,
    user: dict = Depends(get_current_user)
):
    """Save styled image to character"""
    try:
        body = await request.json()
        styled_image_b64 = body.get("styled_image_b64")
        style = body.get("style", "cartoon")
        use_styled = body.get("use_styled", False)

        if not styled_image_b64:
            raise HTTPException(status_code=400, detail="styled_image_b64 required")

        char = await db.characters.find_one({"id": char_id, "owner_id": user["id"]})
        if not char:
            raise HTTPException(status_code=404, detail="Character not found")

        # Decode base64 and upload to S3
        try:
            img_bytes = base64.b64decode(styled_image_b64)
            s3_key = f"users/{user['id']}/characters/{char_id}/styled_{style}.png"
            s3_url = await s3_service.upload(s3_key, img_bytes, 'image/png')

            # Create media asset
            asset_id = str(uuid.uuid4())
            await db.media_assets.insert_one({
                "id": asset_id,
                "type": "image",
                "format": "png",
                "s3_key": s3_key,
                "s3_url": s3_url,
                "character_id": char_id,
                "owner_id": user["id"],
                "style": style,
                "is_styled": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            })

            # Update character with styled image URL - use S3 URL directly
            await db.characters.update_one(
                {"id": char_id},
                {"$set": {
                    "styled_photo_url": s3_url,
                    "styled_photo_asset_id": asset_id,
                    "styled_photo_s3_key": s3_key,
                    "image_style": style,
                    "use_styled": use_styled
                }}
            )

            updated = await db.characters.find_one({"id": char_id}, {"_id": 0})
            return updated
        except Exception as e:
            logger.error(f"Failed to save styled image: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to save image: {str(e)}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Save styled image error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== DATA MIGRATION ROUTES ====================

@api_router.post("/admin/migrate-to-s3-urls")
async def migrate_media_urls_to_s3(user: dict = Depends(get_current_user)):
    """
    Migrate all /api/media/ URLs to direct S3 URLs
    Updates: scenes, characters, stories, jobs
    """
    try:
        migration_stats = {
            "scenes_updated": 0,
            "characters_updated": 0,
            "stories_updated": 0,
            "jobs_updated": 0,
            "errors": []
        }

        # Helper function to get S3 URL from /api/media/ URL
        async def get_s3_url(media_url):
            if not media_url or not media_url.startswith("/api/media/"):
                return media_url

            asset_id = media_url.split("/")[-1]
            asset = await db.media_assets.find_one({"id": asset_id}, {"_id": 0})
            if asset and asset.get("s3_url"):
                return asset["s3_url"]
            return media_url  # Return original if not found

        # 1. Update Scenes
        logger.info("Migrating scenes...")
        scenes = await db.scenes.find({}, {"_id": 0}).to_list(10000)
        for scene in scenes:
            updates = {}

            if scene.get("image_url", "").startswith("/api/media/"):
                s3_url = await get_s3_url(scene["image_url"])
                if s3_url != scene["image_url"]:
                    updates["image_url"] = s3_url

            if scene.get("video_url", "").startswith("/api/media/"):
                s3_url = await get_s3_url(scene["video_url"])
                if s3_url != scene["video_url"]:
                    updates["video_url"] = s3_url

            if scene.get("audio_url", "").startswith("/api/media/"):
                s3_url = await get_s3_url(scene["audio_url"])
                if s3_url != scene["audio_url"]:
                    updates["audio_url"] = s3_url

            if updates:
                await db.scenes.update_one(
                    {"id": scene["id"]},
                    {"$set": updates}
                )
                migration_stats["scenes_updated"] += 1

        # 2. Update Characters
        logger.info("Migrating characters...")
        characters = await db.characters.find({}, {"_id": 0}).to_list(10000)
        for char in characters:
            updates = {}

            if char.get("reference_image", "").startswith("/api/media/"):
                s3_url = await get_s3_url(char["reference_image"])
                if s3_url != char["reference_image"]:
                    updates["reference_image"] = s3_url

            if char.get("styled_photo_url", "").startswith("/api/media/"):
                s3_url = await get_s3_url(char["styled_photo_url"])
                if s3_url != char["styled_photo_url"]:
                    updates["styled_photo_url"] = s3_url

            if updates:
                await db.characters.update_one(
                    {"id": char["id"]},
                    {"$set": updates}
                )
                migration_stats["characters_updated"] += 1

        # 3. Update Stories
        logger.info("Migrating stories...")
        stories = await db.stories.find({}, {"_id": 0}).to_list(10000)
        for story in stories:
            updates = {}

            if story.get("music_url", "").startswith("/api/media/"):
                s3_url = await get_s3_url(story["music_url"])
                if s3_url != story["music_url"]:
                    updates["music_url"] = s3_url

            if updates:
                await db.stories.update_one(
                    {"id": story["id"]},
                    {"$set": updates}
                )
                migration_stats["stories_updated"] += 1

        # 4. Update Jobs
        logger.info("Migrating jobs...")
        jobs = await db.generation_jobs.find({}, {"_id": 0}).to_list(10000)
        for job in jobs:
            updates = {}

            if job.get("result_url", "").startswith("/api/media/"):
                s3_url = await get_s3_url(job["result_url"])
                if s3_url != job["result_url"]:
                    updates["result_url"] = s3_url

            if updates:
                await db.generation_jobs.update_one(
                    {"id": job["id"]},
                    {"$set": updates}
                )
                migration_stats["jobs_updated"] += 1

        logger.info(f"Migration complete: {migration_stats}")

        return {
            "success": True,
            "message": "Media URLs migrated to S3",
            "stats": migration_stats
        }

    except Exception as e:
        logger.error(f"Migration error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== DOODLE TO CHARACTER ROUTES ====================

@api_router.post("/doodle/convert-to-character")
async def convert_doodle_to_character(request: Request, user: dict = Depends(get_current_user)):
    """
    Convert a hand-drawn doodle to a 3D character using Gemini Nano Banana
    Uses gemini-2.5-flash-image model for image-to-image conversion
    """
    try:
        body = await request.json()
        image_base64 = body.get("image_base64")
        style = body.get("style", "3d_cartoon")
        role = body.get("role", "hero")

        if not image_base64:
            raise HTTPException(status_code=400, detail="image_base64 required")

        # Style-specific prompts
        style_prompts = {
            "3d_cartoon": "Convert this sketch into a high-quality 3D cartoon character with smooth skin, rounded features, and Disney-Pixar style. Use subsurface scattering for realistic skin, rounded mesh topology, and vibrant colors. Make it child-friendly and appealing.",
            "anime": "Transform this drawing into a beautiful anime-style character with large expressive eyes, detailed hair, and cel-shaded rendering. Use vibrant colors and clean line art in Japanese animation style.",
            "realistic": "Convert this sketch into a photorealistic 3D character with detailed textures, natural lighting, and lifelike proportions. Add realistic skin tones, fabric details, and subtle imperfections.",
            "pixar": "Transform this doodle into a Pixar-style 3D character with glossy textures, exaggerated proportions, large expressive eyes, and vibrant colors. Add depth, rim lighting, and a polished CGI appearance."
        }

        # Role-specific additions
        role_additions = {
            "hero": "Make them look brave, confident, and heroic with a friendly smile.",
            "villain": "Give them a mischievous or mysterious appearance with dramatic features.",
            "animal": "Create an adorable, friendly animal character with big eyes and cute features.",
            "magical": "Add magical, fantastical elements like glowing effects or mystical details."
        }

        prompt = f"{style_prompts.get(style, style_prompts['3d_cartoon'])} {role_additions.get(role, '')}"

        logger.info(f"Converting doodle with style={style}, role={role}")

        # Call Gemini API directly
        gemini_api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not gemini_api_key:
            raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")

        # Prepare Gemini API request
        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key={gemini_api_key}"

        payload = {
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": "image/png",
                            "data": image_base64
                        }
                    }
                ]
            }],
            "generationConfig": {
                "response_modalities": ["IMAGE"]
            }
        }

        # Make request to Gemini API
        response = await asyncio.to_thread(
            http_requests.post,
            gemini_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=60
        )

        if response.status_code != 200:
            logger.error(f"Gemini API error: {response.status_code} - {response.text}")
            raise HTTPException(status_code=500, detail=f"Gemini API error: {response.status_code}")

        result = response.json()

        # Extract the generated image
        if "candidates" in result and len(result["candidates"]) > 0:
            parts = result["candidates"][0].get("content", {}).get("parts", [])
            for part in parts:
                if "inline_data" in part:
                    generated_image_b64 = part["inline_data"]["data"]

                    # Decode and upload to S3
                    img_bytes = base64.b64decode(generated_image_b64)
                    s3_key = f"users/{user['id']}/doodles/character_{uuid.uuid4().hex[:8]}.png"
                    s3_url = await s3_service.upload(s3_key, img_bytes, 'image/png')

                    # Create media asset
                    asset_id = str(uuid.uuid4())
                    await db.media_assets.insert_one({
                        "id": asset_id,
                        "type": "image",
                        "format": "png",
                        "s3_key": s3_key,
                        "s3_url": s3_url,
                        "owner_id": user["id"],
                        "created_from_doodle": True,
                        "doodle_style": style,
                        "doodle_role": role,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })

                    logger.info(f"Doodle converted successfully, saved to S3: {s3_key}")

                    return {
                        "success": True,
                        "converted_image_url": s3_url,
                        "s3_url": s3_url,
                        "asset_id": asset_id
                    }

        raise HTTPException(status_code=500, detail="No image generated by Gemini")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Doodle conversion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== STORY ROUTES ====================

@api_router.post("/stories/fix-statuses")
async def fix_story_statuses(user: dict = Depends(get_current_user)):
    """
    Utility endpoint to fix story statuses
    Sets stories with scenes to 'generated' if they're stuck in 'generating'
    """
    try:
        # Find all stories for this user
        stories = await db.stories.find({"owner_id": user["id"]}, {"_id": 0}).to_list(1000)
        fixed_count = 0

        for story in stories:
            # Count scenes for this story
            scene_count = await db.scenes.count_documents({"story_id": story["id"]})

            # If story has scenes but is not marked as generated, fix it
            if scene_count > 0 and story.get("status") not in ["generated", "completed"]:
                await db.stories.update_one(
                    {"id": story["id"]},
                    {"$set": {
                        "status": "generated",
                        "scene_count": scene_count
                    }}
                )
                fixed_count += 1
                logger.info(f"Fixed status for story {story['id']} ({story.get('title')}) with {scene_count} scenes")

        return {
            "success": True,
            "fixed_count": fixed_count,
            "message": f"Fixed {fixed_count} story statuses"
        }
    except Exception as e:
        logger.error(f"Fix story statuses error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
    # Fetch music URL if exists
    music_asset = await db.media_assets.find_one({"story_id": story_id, "type": "music"}, {"_id": 0})
    if music_asset:
        story["music_url"] = music_asset.get("s3_url") or f"/api/media/{music_asset['id']}"
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

    if "duration_seconds" in update_data:
        update_data["duration_seconds"] = max(1, int(update_data["duration_seconds"]))
    if "trim_start_seconds" in update_data:
        update_data["trim_start_seconds"] = max(0, float(update_data["trim_start_seconds"]))
    if "trim_end_seconds" in update_data:
        update_data["trim_end_seconds"] = float(update_data["trim_end_seconds"]) if update_data["trim_end_seconds"] is not None else None
        if update_data["trim_end_seconds"] is not None:
            update_data["trim_end_seconds"] = max(update_data.get("trim_start_seconds", 0), update_data["trim_end_seconds"])
    if "transition_type" in update_data:
        if update_data["transition_type"] not in {"cut", "fade"}:
            raise HTTPException(status_code=400, detail="Invalid transition type")

    result = await db.scenes.update_one({"id": scene_id, "story_id": story_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Scene not found")
    return await db.scenes.find_one({"id": scene_id}, {"_id": 0})

@api_router.post("/stories/{story_id}/scenes/{scene_id}/regenerate-image")
async def regenerate_scene_image(story_id: str, scene_id: str, body: ImageRegenRequest = ImageRegenRequest(), user: dict = Depends(get_current_user)):
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
    provider = body.provider or story.get("image_provider", "nano_banana")
    enqueue_task(image_regeneration_task, story, scene, job_id, provider, fallback_coro=run_image_regeneration)
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
        char_ref_images = []
        for c in characters:
            traits = ", ".join(c.get("personality_traits", []))
            char_descriptions += f"- {c['name']}: Role={c['role']}, Traits={traits}, Speaking style={c.get('speaking_style', 'normal')}\n"
            # Build accessible URL for character reference image
            if c.get("reference_image_s3_key"):
                try:
                    fresh_url = s3_service.get_signed_url(c["reference_image_s3_key"], expires=3600)
                    char_ref_images.append(fresh_url)
                except Exception:
                    pass
            elif c.get("reference_image_asset_id"):
                # Fetch base64 from MongoDB and pass inline
                asset = await db.media_assets.find_one({"id": c["reference_image_asset_id"]}, {"_id": 0})
                if asset and asset.get("data"):
                    char_ref_images.append(f"data:image/{asset.get('format','png')};base64,{asset['data']}")
                elif asset and asset.get("s3_url"):
                    char_ref_images.append(asset["s3_url"])

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

        if not EMERGENT_LLM_KEY:
            raise RuntimeError("LLM key not configured")

        logger.info(f"Generating story text for {story_id} with OpenAI")
        client = OpenAI(api_key=EMERGENT_LLM_KEY)
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a children's story writer. Return ONLY valid JSON. No markdown.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.4,
        )
        msg = completion.choices[0].message
        if isinstance(msg.content, str):
            response_text = msg.content
        else:
            response_text = "".join(
                part.text for part in msg.content if getattr(part, "type", "") == "text"
            )
        story_data = parse_json_response(response_text)

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
                "duration_seconds": 5,
                "trim_start_seconds": 0,
                "trim_end_seconds": None,
                "transition_type": "cut",
                "include_in_video": True,
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

                aspect_ratio = story.get("image_aspect_ratio", "16:9")
                preferred_provider = story.get("image_provider", "nano_banana")
                logger.info(f"Generating image for scene {i+1}/{total} via {preferred_provider}")
                provider_used, results = await generate_scene_image(img_prompt, aspect_ratio, char_ref_images if char_ref_images else None, preferred_provider)

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
                        "provider": provider_used,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })
                    await db.scenes.update_one(
                        {"id": scene["id"]},
                        {"$set": {"image_url": s3_url}}
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

        for scene in scenes:
            try:
                if not EMERGENT_LLM_KEY:
                    raise RuntimeError("LLM key not configured")

                check_prompt = f"""Analyze this children's story content:
Scene Text: {scene['scene_text']}
Image Prompt: {scene['image_prompt']}

Check for: violence, adult themes, stereotypes, age-inappropriate language.
Return JSON: {{"safe": true, "issues": [], "severity": "none"}}"""

                client = OpenAI(api_key=EMERGENT_LLM_KEY)
                completion = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a child safety content moderator. Analyze content for children ages 3-10. Return ONLY JSON.",
                        },
                        {"role": "user", "content": check_prompt},
                    ],
                    temperature=0.1,
                )
                msg = completion.choices[0].message
                if isinstance(msg.content, str):
                    resp_text = msg.content
                else:
                    resp_text = "".join(
                        part.text for part in msg.content if getattr(part, "type", "") == "text"
                    )
                result = parse_json_response(resp_text)

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


async def generate_scene_image(img_prompt: str, aspect_ratio: str, reference_images: list, preferred_provider: str = "nano_banana"):
    if preferred_provider == "minimax":
        provider_order = ["minimax"]  
    else:
        provider_order = ["nano_banana"]

    last_error = None
    for provider in provider_order:
        try:
            if provider == "nano_banana":
                results = await image_gen_service.generate_image(img_prompt, aspect_ratio=aspect_ratio, reference_images=reference_images)
            else:
                results = await minimax_service.generate_image(img_prompt, aspect_ratio=aspect_ratio, reference_images=reference_images)
            if results:
                return provider, results
        except Exception as e:
            last_error = e
            logger.error(f"Image generation failed using {provider}: {e}")  # ← ERROR not WARNING
    raise Exception(f"Image generation failed: {last_error}")


async def run_image_regeneration(story: dict, scene: dict, job_id: str, provider: str = "nano_banana"):
    try:
        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "running", "progress": 10, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

        # Collect character reference images
        char_ref_images = []
        for cid in story.get("character_ids", []):
            c = await db.characters.find_one({"id": cid}, {"_id": 0})
            if c and c.get("reference_image_s3_key"):
                try:
                    fresh_url = s3_service.get_signed_url(c["reference_image_s3_key"], expires=3600)
                    char_ref_images.append(fresh_url)
                except Exception:
                    pass
            elif c and c.get("reference_image_asset_id"):
                asset = await db.media_assets.find_one({"id": c["reference_image_asset_id"]}, {"_id": 0})
                if asset and asset.get("data"):
                    char_ref_images.append(f"data:image/{asset.get('format','png')};base64,{asset['data']}")
                elif asset and asset.get("s3_url"):
                    char_ref_images.append(asset["s3_url"])

        img_prompt = f"{scene['image_prompt']}. Style: {story['visual_style']} illustration, child-friendly, vibrant colors."
        if len(img_prompt) > 1500:
            img_prompt = img_prompt[:1500]

        aspect_ratio = story.get("image_aspect_ratio", "16:9")
        preferred_provider = provider or story.get("image_provider", "nano_banana")
        provider_used, results = await generate_scene_image(img_prompt, aspect_ratio, char_ref_images if char_ref_images else None, preferred_provider)

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
                "provider": provider_used,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            await db.scenes.update_one(
                {"id": scene["id"]},
                {"$set": {"image_url": s3_url}}
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


# ==================== VIDEO / AUDIO / MUSIC GENERATION ====================

VOICE_MAP = {
    "child": "male-qn-qingse",
    "female": "female-shaonv",
    "male": "male-qn-jingying",
    "storyteller": "presenter_male",
}

TONE_MUSIC_PROMPTS = {
    "funny": "Playful upbeat children's music with ukulele piano and light percussion, cheerful and bouncy",
    "adventure": "Epic orchestral children's adventure music with strings timpani and brass, exciting and heroic",
    "bedtime": "Gentle soothing lullaby music with soft piano music box and harp, calm and dreamy",
    "educational": "Cheerful learning music with xylophone glockenspiel and light drums, curious and engaging",
}


async def run_video_generation(story_id: str, job_id: str):
    try:
        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "running", "progress": 5, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

        story = await db.stories.find_one({"id": story_id}, {"_id": 0})
        scenes = await db.scenes.find({"story_id": story_id}, {"_id": 0}).sort("scene_number", 1).to_list(100)
        user_id = story.get("owner_id", "unknown")
        total = len(scenes)

        # Collect character info + reference images for video
        characters = []
        char_ref_images = []
        for cid in story.get("character_ids", []):
            c = await db.characters.find_one({"id": cid}, {"_id": 0})
            if c:
                characters.append(c)
                if c.get("reference_image_s3_key"):
                    try:
                        fresh_url = s3_service.get_signed_url(c["reference_image_s3_key"], expires=3600)
                        char_ref_images.append(fresh_url)
                    except Exception:
                        pass
                elif c.get("reference_image_asset_id"):
                    asset = await db.media_assets.find_one({"id": c["reference_image_asset_id"]}, {"_id": 0})
                    if asset and asset.get("s3_url"):
                        char_ref_images.append(asset["s3_url"])

        for i, scene in enumerate(scenes):
            try:
                # Build rich prompt with character details (from uploaded reference code pattern)
                char_desc_parts = []
                for c in characters:
                    name = c.get("name", "")
                    traits = ", ".join(c.get("personality_traits", []))
                    desc = name
                    if traits:
                        desc += f" ({traits})"
                    if c.get("description"):
                        desc += f" - {c['description'][:60]}"
                    char_desc_parts.append(desc)

                vid_prompt = scene.get("video_prompt") or scene.get("image_prompt", "")
                if char_desc_parts:
                    vid_prompt += f". Characters: {'; '.join(char_desc_parts)}"
                vid_prompt += f". Setting: {scene.get('scene_title', '')}. {story.get('visual_style', 'cartoon')} style, child-friendly, vibrant colors."
                if len(vid_prompt) > 2000:
                    vid_prompt = vid_prompt[:2000]

                # Determine generation type: use image-to-video if scene has an image
                first_frame_url = None
                gen_type = "text-to-video"
                if scene.get("image_url"):
                    img_asset_id = scene["image_url"].split("/")[-1]
                    img_asset = await db.media_assets.find_one({"id": img_asset_id}, {"_id": 0})
                    if img_asset:
                        if img_asset.get("s3_key"):
                            try:
                                first_frame_url = s3_service.get_signed_url(img_asset["s3_key"], expires=3600)
                                gen_type = "image-to-video"
                            except Exception:
                                pass
                        elif img_asset.get("s3_url"):
                            first_frame_url = img_asset["s3_url"]
                            gen_type = "image-to-video"

                logger.info(f"Generating video for scene {i+1}/{total} ({gen_type})")
                result = await minimax_service.generate_video(
                    vid_prompt,
                    subject_references=char_ref_images if char_ref_images else None,
                    first_frame_image=first_frame_url,
                    generation_type=gen_type
                )

                if result.get("url"):
                    s3_key = f"users/{user_id}/stories/{story_id}/scenes/{scene['scene_number']}/video.mp4"
                    s3_url = await s3_service.upload_from_url(s3_key, result["url"], 'video/mp4')

                    asset_id = str(uuid.uuid4())
                    await db.media_assets.insert_one({
                        "id": asset_id, "type": "video", "format": "mp4",
                        "s3_key": s3_key, "s3_url": s3_url,
                        "scene_id": scene["id"], "story_id": story_id,
                        "provider": "minimax", "generation_type": gen_type,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })
                    await db.scenes.update_one(
                        {"id": scene["id"]},
                        {"$set": {"video_url": f"/api/media/{asset_id}"}}
                    )
                    logger.info(f"Video uploaded to S3 for scene {i+1}")
            except Exception as e:
                logger.error(f"Video gen failed for scene {scene['id']}: {e}")

            progress = 5 + int((i + 1) / total * 90)
            await db.generation_jobs.update_one(
                {"id": job_id},
                {"$set": {"progress": progress, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )

        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "completed", "progress": 100, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        logger.info(f"Video generation completed for story {story_id}")

        # Send notifications to user and parent
        try:
            user = await db.users.find_one({"id": user_id}, {"_id": 0})
            if user:
                # Build frontend video URL
                frontend_url = os.environ.get('REACT_APP_BACKEND_URL', '').replace('/api', '')
                video_url = f"{frontend_url}/stories/{story_id}/edit"

                # Get parent email from user settings
                settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
                parent_email = settings.get("parent_email") if settings else None

                await notify_video_complete(
                    user_email=user.get("email"),
                    parent_email=parent_email,
                    phone_number=user.get("phone"),
                    story_title=story.get("title", "Your Story"),
                    video_url=video_url
                )
                logger.info(f"Notifications sent for video completion: {story_id}")
        except Exception as notif_err:
            logger.error(f"Failed to send notifications: {notif_err}")

    except Exception as e:
        logger.error(f"Video generation failed: {e}")
        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "failed", "error_message": str(e), "updated_at": datetime.now(timezone.utc).isoformat()}}
        )


async def run_audio_generation(story_id: str, job_id: str, voice_style: str = "storyteller"):
    try:
        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "running", "progress": 5, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

        story = await db.stories.find_one({"id": story_id}, {"_id": 0})
        scenes = await db.scenes.find({"story_id": story_id}, {"_id": 0}).sort("scene_number", 1).to_list(100)
        user_id = story.get("owner_id", "unknown")
        voice_id = VOICE_MAP.get(voice_style, "male-qn-qingse")
        total = len(scenes)

        for i, scene in enumerate(scenes):
            try:
                narration = scene.get("narration_text") or scene.get("scene_text", "")
                if not narration.strip():
                    continue

                audio_bytes = None
                provider = "minimax"

                # Try MiniMax TTS first
                try:
                    logger.info(f"Trying MiniMax TTS for scene {i+1}/{total}")
                    audio_bytes = await minimax_service.generate_tts(narration, voice_id)
                except Exception as mm_err:
                    logger.warning(f"MiniMax TTS failed: {mm_err}. Trying fallbacks...")

                # Fallback 1: ElevenLabs
                if not audio_bytes:
                    try:
                        logger.info(f"Trying ElevenLabs TTS for scene {i+1}/{total}")
                        audio_bytes = await elevenlabs_service.generate_tts(narration, voice_style)
                        provider = "elevenlabs"
                    except Exception as el_err:
                        logger.warning(f"ElevenLabs TTS failed: {el_err}. Using Edge TTS...")

                # Fallback 2: Edge TTS (free, always works)
                if not audio_bytes:
                    try:
                        logger.info(f"Using Edge TTS for scene {i+1}/{total}")
                        audio_bytes = await edge_tts_service.generate_tts(narration, voice_style)
                        provider = "edge-tts"
                    except Exception:
                        logger.error(f"All TTS providers failed for scene {scene['id']}")
                        continue

                s3_key = f"users/{user_id}/stories/{story_id}/scenes/{scene['scene_number']}/narration.mp3"
                s3_url = await s3_service.upload(s3_key, audio_bytes, 'audio/mpeg')

                asset_id = str(uuid.uuid4())
                await db.media_assets.insert_one({
                    "id": asset_id, "type": "audio", "format": "mp3",
                    "s3_key": s3_key, "s3_url": s3_url,
                    "scene_id": scene["id"], "story_id": story_id,
                    "provider": provider,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
                await db.scenes.update_one(
                    {"id": scene["id"]},
                    {"$set": {"audio_url": f"/api/media/{asset_id}"}}
                )
                logger.info(f"Audio ({provider}) uploaded to S3 for scene {i+1}")
            except Exception as e:
                logger.error(f"Audio gen failed for scene {scene['id']}: {e}")

            progress = 5 + int((i + 1) / total * 90)
            await db.generation_jobs.update_one(
                {"id": job_id},
                {"$set": {"progress": progress, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )

        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "completed", "progress": 100, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        logger.info(f"Audio generation completed for story {story_id}")

    except Exception as e:
        logger.error(f"Audio generation failed: {e}")
        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "failed", "error_message": str(e), "updated_at": datetime.now(timezone.utc).isoformat()}}
        )


async def run_music_generation(story_id: str, job_id: str):
    try:
        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "running", "progress": 10, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

        story = await db.stories.find_one({"id": story_id}, {"_id": 0})
        user_id = story.get("owner_id", "unknown")
        tone = story.get("tone", "funny")
        music_prompt = TONE_MUSIC_PROMPTS.get(tone, TONE_MUSIC_PROMPTS["funny"])
        music_prompt += f", background music for a children's {tone} story"

        logger.info(f"Generating music for story {story_id}")
        result = await minimax_service.generate_music(music_prompt)

        if result.get("type") == "url" and result.get("data"):
            s3_key = f"users/{user_id}/stories/{story_id}/music/bg_music.mp3"
            s3_url = await s3_service.upload_from_url(s3_key, result["data"], 'audio/mpeg')
        elif result.get("type") == "bytes" and result.get("data"):
            s3_key = f"users/{user_id}/stories/{story_id}/music/bg_music.mp3"
            s3_url = await s3_service.upload(s3_key, result["data"], 'audio/mpeg')
        else:
            raise Exception("No music data returned")

        asset_id = str(uuid.uuid4())
        await db.media_assets.insert_one({
            "id": asset_id, "type": "music", "format": "mp3",
            "s3_key": s3_key, "s3_url": s3_url, "story_id": story_id,
            "provider": "minimax",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        await db.stories.update_one(
            {"id": story_id},
            {"$set": {"music_url": f"/api/media/{asset_id}"}}
        )

        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "completed", "progress": 100, "result_url": f"/api/media/{asset_id}", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        logger.info(f"Music generated for story {story_id}")

    except Exception as e:
        logger.error(f"Music generation failed: {e}")
        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "failed", "error_message": str(e), "updated_at": datetime.now(timezone.utc).isoformat()}}
        )


# ==================== FFMPEG VIDEO EXPORT ====================

DEFAULT_SCENE_DURATION = 5
TRANSITION_FADE_SECONDS = 0.4

async def download_media_file(asset_url: str, dest_path: str):
    """Download media from S3/MongoDB asset URL to local file."""
    if not asset_url:
        return False
    asset_id = asset_url.split("/")[-1] if "/api/media/" in asset_url else asset_url
    asset = await db.media_assets.find_one({"id": asset_id}, {"_id": 0})
    if not asset:
        return False
    if asset.get("s3_key"):
        try:
            url = s3_service.get_signed_url(asset["s3_key"])
            resp = await asyncio.to_thread(http_requests.get, url, timeout=120)
            if resp.status_code == 200:
                with open(dest_path, 'wb') as f:
                    f.write(resp.content)
                return True
        except Exception as e:
            logger.error(f"S3 download failed: {e}")
    if asset.get("s3_url"):
        try:
            resp = await asyncio.to_thread(http_requests.get, asset["s3_url"], timeout=120)
            if resp.status_code == 200:
                with open(dest_path, 'wb') as f:
                    f.write(resp.content)
                return True
        except Exception:
            pass
    if asset.get("data"):
        with open(dest_path, 'wb') as f:
            f.write(base64.b64decode(asset["data"]))
        return True
    return False


async def run_ffmpeg_export(story_id: str, job_id: str):
    """Compile all scene videos into a single MP4 using imageio (no system ffmpeg required)."""
    tmpdir = tempfile.mkdtemp(prefix="storycraft_export_")
    try:
        await db.generation_jobs.update_one({"id": job_id}, {"$set": {"status": "running", "progress": 5}})

        story = await db.stories.find_one({"id": story_id}, {"_id": 0})
        if not story:
            raise Exception("Story not found")
        user_id = story.get("owner_id", "unknown")

        scenes = await db.scenes.find(
            {"story_id": story_id}, {"_id": 0}
        ).sort("scene_number", 1).to_list(100)
        scenes = [s for s in scenes if s.get("include_in_video", True) and (s.get("video_url") or s.get("image_url"))]

        if not scenes:
            raise Exception("No scenes with video or image content to export")

        TARGET_SIZE = (1280, 720)
        all_frames = []

        for i, scene in enumerate(scenes):
            progress = 10 + int((i / len(scenes)) * 70)
            await db.generation_jobs.update_one({"id": job_id}, {"$set": {"progress": progress, "message": f"Processing scene {i+1}/{len(scenes)}..."}})

            duration = max(1, int(scene.get("duration_seconds") or 5))
            scene_frames = []

            # Try video first
            if scene.get("video_url"):
                try:
                    resp = await asyncio.to_thread(requests.get, scene["video_url"], timeout=60)
                    if resp.status_code == 200:
                        vid_path = os.path.join(tmpdir, f"scene_{i}.mp4")
                        with open(vid_path, "wb") as f:
                            f.write(resp.content)
                        reader = imageio.get_reader(vid_path, format='mp4')
                        for frame in reader:
                            img = Image.fromarray(frame).convert("RGB").resize(TARGET_SIZE)
                            scene_frames.append(np.array(img))
                        reader.close()
                except Exception as e:
                    logger.warning(f"Scene {i} video read failed: {e}")

            # Fall back to image (shown as static frames = duration seconds)
            if not scene_frames and scene.get("image_url"):
                try:
                    resp = await asyncio.to_thread(requests.get, scene["image_url"], timeout=30)
                    if resp.status_code == 200:
                        img = Image.open(BytesIO(resp.content)).convert("RGB").resize(TARGET_SIZE)
                        frame = np.array(img)
                        scene_frames = [frame] * duration  # 1fps, hold for duration seconds
                except Exception as e:
                    logger.warning(f"Scene {i} image read failed: {e}")

            all_frames.extend(scene_frames)

        if not all_frames:
            raise Exception("No frames collected from scenes")

        await db.generation_jobs.update_one({"id": job_id}, {"$set": {"progress": 85, "message": "Compiling final video..."}})

        # Write compiled video using imageio
        export_path = os.path.join(tmpdir, "export.mp4")
        with imageio.get_writer(export_path, format='mp4', fps=1, codec='libx264',
                                output_params=['-preset', 'ultrafast', '-pix_fmt', 'yuv420p']) as writer:
            for frame in all_frames:
                writer.append_data(frame)

        with open(export_path, 'rb') as f:
            video_bytes = f.read()

        asset_id = str(uuid.uuid4())
        s3_key = f"users/{user_id}/stories/{story_id}/exports/final_{asset_id[:8]}.mp4"
        s3_url = await s3_service.upload(s3_key, video_bytes, 'video/mp4')

        await db.media_assets.insert_one({
            "id": asset_id, "type": "video", "format": "mp4",
            "s3_key": s3_key, "s3_url": s3_url, "story_id": story_id,
            "is_export": True, "created_at": datetime.now(timezone.utc).isoformat()
        })

        await db.generation_jobs.update_one({"id": job_id}, {"$set": {
            "status": "completed", "progress": 100,
            "result_url": s3_url,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }})
        logger.info(f"Story video export complete: {story_id} → {len(all_frames)} frames")

    except Exception as e:
        logger.error(f"Story export failed: {e}")
        await db.generation_jobs.update_one({"id": job_id}, {"$set": {"status": "failed", "error_message": str(e)}})
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)



# ==================== AD GENERATION ====================

PLATFORM_CONFIGS = {
    "instagram": {"aspect": "1:1", "max_duration": 60, "label": "Instagram Post"},
    "instagram_reel": {"aspect": "9:16", "max_duration": 90, "label": "Instagram Reel"},
    "youtube": {"aspect": "16:9", "max_duration": 60, "label": "YouTube Video"},
    "youtube_shorts": {"aspect": "9:16", "max_duration": 60, "label": "YouTube Shorts"},
    "whatsapp": {"aspect": "9:16", "max_duration": 30, "label": "WhatsApp Status"},
    "tiktok": {"aspect": "4:3", "max_duration": 60, "label": "TikTok Video"},
    "facebook": {"aspect": "4:5", "max_duration": 30, "label": "Facebook Feed"},
    "linkedin": {"aspect": "1:1", "max_duration": 30, "label": "LinkedIn Post"},
}

async def run_ad_generation(story_id: str, job_id: str, platform: str, style: str, cta_text: str):
    try:
        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "running", "progress": 10, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

        story = await db.stories.find_one({"id": story_id}, {"_id": 0})
        scenes = await db.scenes.find({"story_id": story_id}, {"_id": 0}).sort("scene_number", 1).to_list(100)

        if not scenes:
            raise Exception("No scenes available for ad creation")

        scene_summaries = "\n".join([f"Scene {s['scene_number']}: {s.get('scene_title','')} - {s.get('scene_text','')[:100]}" for s in scenes])
        platform_config = PLATFORM_CONFIGS.get(platform, PLATFORM_CONFIGS["instagram"])

        if not EMERGENT_LLM_KEY:
            raise RuntimeError("LLM key not configured")


        prompt = f"""Create a {platform_config['label']} promotional post for this children's story.

Story Title: {story.get('title','')}
Tone: {story.get('tone','')}
Style: {style}
CTA: {cta_text}

Scenes:
{scene_summaries}

Select the 2-3 best scenes for a {platform_config['max_duration']}s promo video.

Return JSON:
{{"hook_text": "Attention-grabbing opening line", "caption": "Full social media caption (2-3 sentences)", "hashtags": "#tag1 #tag2 #tag3 #tag4 #tag5", "selected_scenes": [1, 3, 5], "overlay_texts": ["Text overlay for scene 1", "Text overlay for scene 2", "Text overlay for scene 3"], "cta_text": "{cta_text}"}}"""

        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"progress": 30, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

        client = OpenAI(api_key=EMERGENT_LLM_KEY)
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert social media marketing copywriter for children's content. Return ONLY valid JSON.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.5,
        )
        msg = completion.choices[0].message
        if isinstance(msg.content, str):
            resp_text = msg.content
        else:
            resp_text = "".join(
                part.text for part in msg.content if getattr(part, "type", "") == "text"
            )
        ad_data = parse_json_response(resp_text)

        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"progress": 60, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

        # Build selected scenes data
        selected = ad_data.get("selected_scenes", [1, 2, 3])
        selected_scenes_data = []
        for snum in selected:
            for s in scenes:
                if s.get("scene_number") == snum:
                    selected_scenes_data.append({
                        "scene_number": snum,
                        "scene_title": s.get("scene_title", ""),
                        "image_url": s.get("image_url"),
                        "video_url": s.get("video_url"),
                    })
                    break

        ad_id = str(uuid.uuid4())
        ad_doc = {
            "id": ad_id,
            "story_id": story_id,
            "user_id": story.get("owner_id"),
            "platform": platform,
            "aspect_ratio": platform_config["aspect"],
            "style": style,
            "hook_text": ad_data.get("hook_text", ""),
            "caption": ad_data.get("caption", ""),
            "hashtags": ad_data.get("hashtags", ""),
            "cta_text": ad_data.get("cta_text", cta_text),
            "overlay_texts": ad_data.get("overlay_texts", []),
            "selected_scenes": selected_scenes_data,
            "status": "ready",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.ad_projects.insert_one(ad_doc)

        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {
                "status": "completed", "progress": 100,
                "result_data": {"ad_id": ad_id},
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        logger.info(f"Ad generated for story {story_id}, platform {platform}")

    except Exception as e:
        logger.error(f"Ad generation failed: {e}")
        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "failed", "error_message": str(e), "updated_at": datetime.now(timezone.utc).isoformat()}}
        )


@celery_app.task(name="tasks.story_generation")
def story_generation_task(story_id: str, job_id: str):
    run_celery_async(run_story_generation(story_id, job_id))


@celery_app.task(name="tasks.pdf_generation")
def pdf_generation_task(story_id: str, job_id: str):
    run_celery_async(run_pdf_generation(story_id, job_id))


@celery_app.task(name="tasks.video_generation")
def video_generation_task(story_id: str, job_id: str):
    run_celery_async(run_video_generation(story_id, job_id))


@celery_app.task(name="tasks.audio_generation")
def audio_generation_task(story_id: str, job_id: str, voice_style: str):
    run_celery_async(run_audio_generation(story_id, job_id, voice_style))


@celery_app.task(name="tasks.music_generation")
def music_generation_task(story_id: str, job_id: str):
    run_celery_async(run_music_generation(story_id, job_id))


@celery_app.task(name="tasks.ffmpeg_export")
def ffmpeg_export_task(story_id: str, job_id: str):
    run_celery_async(run_ffmpeg_export(story_id, job_id))


@celery_app.task(name="tasks.ad_generation")
def ad_generation_task(story_id: str, job_id: str, platform: str, style: str, cta_text: str):
    run_celery_async(run_ad_generation(story_id, job_id, platform, style, cta_text))


@celery_app.task(name="tasks.image_regeneration")
def image_regeneration_task(story: dict, scene: dict, job_id: str, provider: str = "nano_banana"):
    run_celery_async(run_image_regeneration(story, scene, job_id, provider))


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
    enqueue_task(story_generation_task, story_id, job_id, fallback_coro=run_story_generation)
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
    enqueue_task(pdf_generation_task, story_id, job_id, fallback_coro=run_pdf_generation)
    return {"job_id": job_id, "status": "pending"}


class VideoGenRequest(BaseModel):
    voice_style: str = "storyteller"

class ReorderScenesRequest(BaseModel):
    scene_ids: List[str]

class AdGenerateRequest(BaseModel):
    platform: str = "instagram"
    duration: int = 15
    style: str = "emotional"
    cta_text: str = "Watch the full story!"

@api_router.post("/stories/{story_id}/generate-video")
async def generate_video_endpoint(story_id: str, user: dict = Depends(get_current_user)):
    story = await db.stories.find_one({"id": story_id, "owner_id": user["id"]})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    scenes = await db.scenes.count_documents({"story_id": story_id})
    if scenes == 0:
        raise HTTPException(status_code=400, detail="Generate story first")

    job_id = str(uuid.uuid4())
    job_doc = {
        "id": job_id, "story_id": story_id, "user_id": user["id"],
        "job_type": "video", "status": "pending", "progress": 0,
        "error_message": None, "result_url": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.generation_jobs.insert_one(job_doc)
    enqueue_task(video_generation_task, story_id, job_id, fallback_coro=run_video_generation)
    return {"job_id": job_id, "status": "pending"}


@api_router.post("/stories/{story_id}/generate-audio")
async def generate_audio_endpoint(story_id: str, body: VideoGenRequest = VideoGenRequest(), user: dict = Depends(get_current_user)):
    story = await db.stories.find_one({"id": story_id, "owner_id": user["id"]})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    scenes = await db.scenes.count_documents({"story_id": story_id})
    if scenes == 0:
        raise HTTPException(status_code=400, detail="Generate story first")

    job_id = str(uuid.uuid4())
    job_doc = {
        "id": job_id, "story_id": story_id, "user_id": user["id"],
        "job_type": "audio", "status": "pending", "progress": 0,
        "error_message": None, "result_url": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.generation_jobs.insert_one(job_doc)
    enqueue_task(audio_generation_task, story_id, job_id, body.voice_style, fallback_coro=run_audio_generation)
    return {"job_id": job_id, "status": "pending"}


@api_router.post("/stories/{story_id}/generate-music")
async def generate_music_endpoint(story_id: str, user: dict = Depends(get_current_user)):
    story = await db.stories.find_one({"id": story_id, "owner_id": user["id"]})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    job_id = str(uuid.uuid4())
    job_doc = {
        "id": job_id, "story_id": story_id, "user_id": user["id"],
        "job_type": "music", "status": "pending", "progress": 0,
        "error_message": None, "result_url": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.generation_jobs.insert_one(job_doc)
    enqueue_task(music_generation_task, story_id, job_id, fallback_coro=run_music_generation)
    return {"job_id": job_id, "status": "pending"}


@api_router.post("/stories/{story_id}/export-video")
async def export_video_endpoint(story_id: str, user: dict = Depends(get_current_user)):
    story = await db.stories.find_one({"id": story_id, "owner_id": user["id"]})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    scenes = await db.scenes.count_documents({"story_id": story_id})
    if scenes == 0:
        raise HTTPException(status_code=400, detail="No scenes to export")
    job_id = str(uuid.uuid4())
    job_doc = {
        "id": job_id, "story_id": story_id, "user_id": user["id"],
        "job_type": "export", "status": "pending", "progress": 0,
        "error_message": None, "result_url": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.generation_jobs.insert_one(job_doc)
    enqueue_task(ffmpeg_export_task, story_id, job_id, fallback_coro=run_ffmpeg_export)
    return {"job_id": job_id, "status": "pending"}


@api_router.put("/stories/{story_id}/reorder-scenes")
async def reorder_scenes(story_id: str, body: ReorderScenesRequest, user: dict = Depends(get_current_user)):
    story = await db.stories.find_one({"id": story_id, "owner_id": user["id"]})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    for idx, scene_id in enumerate(body.scene_ids):
        await db.scenes.update_one(
            {"id": scene_id, "story_id": story_id},
            {"$set": {"scene_number": idx + 1}}
        )
    scenes = await db.scenes.find({"story_id": story_id}, {"_id": 0}).sort("scene_number", 1).to_list(100)
    return scenes


@api_router.post("/stories/{story_id}/generate-ad")
async def generate_ad_endpoint(story_id: str, body: AdGenerateRequest, user: dict = Depends(get_current_user)):
    story = await db.stories.find_one({"id": story_id, "owner_id": user["id"]})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    scenes = await db.scenes.count_documents({"story_id": story_id})
    if scenes == 0:
        raise HTTPException(status_code=400, detail="Generate story first")
    job_id = str(uuid.uuid4())
    job_doc = {
        "id": job_id, "story_id": story_id, "user_id": user["id"],
        "job_type": "ad", "status": "pending", "progress": 0,
        "error_message": None, "result_url": None, "result_data": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.generation_jobs.insert_one(job_doc)
    enqueue_task(ad_generation_task, story_id, job_id, body.platform, body.style, body.cta_text, fallback_coro=run_ad_generation)
    return {"job_id": job_id, "status": "pending"}


@api_router.get("/stories/{story_id}/ads")
async def list_ads(story_id: str, user: dict = Depends(get_current_user)):
    story = await db.stories.find_one({"id": story_id, "owner_id": user["id"]})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    ads = await db.ad_projects.find({"story_id": story_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return ads


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

    # S3-stored media: redirect to presigned URL
    if asset.get("s3_key"):
        try:
            url = s3_service.get_signed_url(asset["s3_key"])
            return RedirectResponse(url)
        except Exception as e:
            logger.error(f"S3 signed URL error: {e}")

    # S3 URL fallback
    if asset.get("s3_url"):
        return RedirectResponse(asset["s3_url"])

    # Legacy: serve from MongoDB base64
    if asset.get("data"):
        data = base64.b64decode(asset["data"])
        media_type = asset.get("type", "image")
        fmt = asset.get("format", "png")
        if media_type == "pdf":
            return Response(content=data, media_type="application/pdf",
                          headers={"Content-Disposition": f"attachment; filename=story_{asset_id[:8]}.pdf"})
        elif media_type == "video":
            return Response(content=data, media_type=f"video/{fmt}")
        elif media_type in ("audio", "music"):
            return Response(content=data, media_type=f"audio/{fmt}")
        return Response(content=data, media_type=f"image/{fmt}")

    raise HTTPException(status_code=404, detail="Media data not found")


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


# ==================== WELLBEING MODULE ====================
from wellbeing import wellbeing_router, inject_deps as wellbeing_inject
wellbeing_inject(db, EMERGENT_LLM_KEY, JWT_SECRET, pwd_context, logger)
api_router.include_router(wellbeing_router)



# ==================== SCENE GRID EDITOR ENDPOINTS ====================

@api_router.post("/media/presigned-url")
async def get_presigned_upload_url(filename: str, content_type: str, user: dict = Depends(get_current_user)):
    try:
        file_ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'bin'
        unique_filename = f"{uuid.uuid4().hex}.{file_ext}"
        s3_key = f"user-uploads/{user['id']}/{unique_filename}"
        # PUT presigned URL — client uploads directly to S3
        presigned_put_url = s3_service.s3.generate_presigned_url(
            'put_object',
            Params={'Bucket': s3_service.bucket, 'Key': s3_key, 'ContentType': content_type},
            ExpiresIn=3600
        )
        # GET presigned URL — used to view/play the file after upload
        presigned_get_url = s3_service.get_signed_url(s3_key, expires=604800)
        return {
            # Preferred explicit field names
            "upload_url": presigned_put_url,
            "view_url": presigned_get_url,
            "s3_key": s3_key,
            # Backward compatibility for existing clients
            "presigned_url": presigned_put_url,
            "s3_url": presigned_get_url,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/scenes/{scene_id}")
async def update_scene_standalone(scene_id: str, data: SceneGridUpdate, user: dict = Depends(get_current_user)):
    scene = await db.scenes.find_one({"id": scene_id}, {"_id": 0})
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    story = await db.stories.find_one({"id": scene["story_id"], "owner_id": user["id"]})
    if not story:
        raise HTTPException(status_code=403, detail="Forbidden")
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if updates:
        await db.scenes.update_one({"id": scene_id}, {"$set": updates})
    return await db.scenes.find_one({"id": scene_id}, {"_id": 0})

@api_router.post("/scenes/{scene_id}/generate-image")
async def generate_scene_image_v2(scene_id: str, user: dict = Depends(get_current_user)):
    scene = await db.scenes.find_one({"id": scene_id}, {"_id": 0})
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    try:
        prompt = scene.get("image_prompt") or scene.get("scene_text") or ""
        if not prompt.strip():
            raise Exception(f"No prompt found for scene {scene_id}")

        prompt_text = f"{prompt}. High quality children's illustration, vibrant colors, child-friendly."

        # Safe story lookup
        story_id = scene.get("story_id")
        preferred_provider = "nano_banana"
        aspect_ratio = "16:9"

        if story_id:
            story = await db.stories.find_one({"id": story_id}, {"_id": 0})
            if story:
                preferred_provider = story.get("image_provider") or "nano_banana"
                aspect_ratio = story.get("image_aspect_ratio") or "16:9"
            else:
                logger.warning(f"Story {story_id} not found, using defaults")
        else:
            logger.warning(f"Scene {scene_id} has no story_id, using defaults")

        logger.info(f"Generating image: scene={scene_id} provider={preferred_provider} aspect={aspect_ratio}")

        provider_used, results = await generate_scene_image(
            prompt_text,
            aspect_ratio,
            None,
            preferred_provider
        )

        if not results:
            raise Exception("No image generated")

        result_type, result_data = results[0]

        if not result_data:
            raise Exception(f"Empty result from {provider_used}")

        s3_key = f"scenes/{scene_id}/image_{uuid.uuid4().hex[:8]}.png"

        if result_type == "base64":
            img_bytes = base64.b64decode(result_data)
            await s3_service.upload(s3_key, img_bytes, 'image/png')
            image_url = s3_service.get_public_url(s3_key)
        elif result_type == "url":
            await s3_service.upload_from_url(s3_key, result_data, 'image/png')
            image_url = s3_service.get_public_url(s3_key)
        else:
            raise Exception(f"Unknown result type: {result_type}")

        await db.scenes.update_one({"id": scene_id}, {"$set": {"image_url": image_url}})
        return {"success": True, "image_url": image_url}

    except Exception as e:
        import traceback
        logger.error(f"Scene image generation failed: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))
        

class DoodleToImageRequest(BaseModel):
    doodle_base64: str
    scene_title: Optional[str] = ""


@api_router.post("/scenes/{scene_id}/doodle-to-image")
async def convert_doodle_to_image(scene_id: str, request: DoodleToImageRequest, user: dict = Depends(get_current_user)):
    """
    Convert a hand-drawn doodle to a polished scene image using Gemini Nano Banana.
    1. Save the doodle to S3
    2. Use Nano Banana to generate a refined image based on the doodle
    3. Save the generated image to S3
    4. Update the scene with the new image URL
    """
    scene = await db.scenes.find_one({"id": scene_id}, {"_id": 0})
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    try:
        # Step 1: Decode and save the doodle to S3
        doodle_bytes = base64.b64decode(request.doodle_base64)
        doodle_key = f"scenes/{scene_id}/doodle_{uuid.uuid4().hex[:8]}.png"
        doodle_url = await s3_service.upload(doodle_key, doodle_bytes, 'image/png')
        logger.info(f"Doodle uploaded to S3: {doodle_url}")

        # Step 2: Convert doodle to 3D colored smooth image using Gemini API directly
        conversion_prompt = (
            "Transform this hand-drawn sketch into a 3D colored smooth image. "
            "Keep the exact same composition, shapes and elements from the drawing. "
            "Make it vibrant, polished and professionally rendered with smooth gradients and clean edges."
        )

        gemini_api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not gemini_api_key:
            raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")

        gemini_url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            "gemini-2.5-flash-image:generateContent"
            f"?key={gemini_api_key}"
        )

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": conversion_prompt},
                        {
                            "inlineData": {
                                "mimeType": "image/png",
                                "data": request.doodle_base64,
                            }
                        },
                    ]
                }
            ],
            "generationConfig": {
                "responseMimeType": "image/png",
                "responseSchema": {"type": "IMAGE"},
            },
        }

        response = await asyncio.to_thread(
            http_requests.post,
            gemini_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=120,
        )

        if response.status_code != 200:
            logger.error(f"Gemini doodle API error: {response.status_code} {response.text}")
            raise HTTPException(status_code=500, detail="Gemini doodle API error")

        result = response.json()
        generated_b64 = None
        for cand in result.get("candidates", []):
            for part in cand.get("content", {}).get("parts", []):
                inline = part.get("inlineData")
                if inline and inline.get("data"):
                    generated_b64 = inline["data"]
                    break
            if generated_b64:
                break

        if not generated_b64:
            raise Exception("No image generated by Gemini for doodle")

        # Step 3: Save the generated image to S3
        generated_img_bytes = base64.b64decode(generated_b64)
        generated_key = f"scenes/{scene_id}/generated_{uuid.uuid4().hex[:8]}.png"
        generated_url = await s3_service.upload(generated_key, generated_img_bytes, 'image/png')
        logger.info(f"Generated image uploaded to S3: {generated_url}")

        # Step 4: Update scene with the new image URL
        await db.scenes.update_one(
            {"id": scene_id},
            {"$set": {
                "image_url": generated_url,
                "doodle_url": doodle_url,
                "image_source": "doodle_conversion"
            }}
        )

        return {
            "success": True,
            "image_url": generated_url,
            "doodle_url": doodle_url
        }

    except Exception as e:
        logger.error(f"Doodle to image conversion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/scenes/{scene_id}/generate-video")
async def generate_scene_video_v2(scene_id: str, user: dict = Depends(get_current_user)):
    scene = await db.scenes.find_one({"id": scene_id}, {"_id": 0})
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    # Read provider from parent story
    preferred_provider = "nano_banana"
    if scene.get("story_id"):
        story = await db.stories.find_one({"id": scene["story_id"]}, {"_id": 0})
        if story:
            preferred_provider = story.get("image_provider") or "nano_banana"
    logger.info(f"Scene video provider: {preferred_provider} for scene {scene_id}")

    job_id = str(uuid.uuid4())
    job_doc = {"id": job_id, "scene_id": scene_id, "user_id": user["id"], "job_type": "scene_video", "status": "pending", "progress": 0, "provider": preferred_provider, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.generation_jobs.insert_one(job_doc)
    enqueue_task(scene_video_task, scene_id, job_id, preferred_provider, fallback_coro=run_scene_video_generation)
    return {"job_id": job_id, "status": "pending"}

async def _get_character_photos(story_id: str) -> list:
    """Fetch up to 2 character reference photos for the story."""
    story = await db.stories.find_one({"id": story_id}, {"_id": 0})
    if not story:
        return []
    char_photos = []
    for cid in (story.get("character_ids") or [])[:2]:
        char = await db.characters.find_one({"id": cid}, {"_id": 0})
        if not char:
            continue
        # Prefer styled photo, fall back to reference_image
        photo_url = char.get("styled_photo_url") or char.get("reference_image")
        if photo_url and not photo_url.startswith("/api/media/"):
            char_photos.append(photo_url)
        elif char.get("reference_image_s3_key"):
            char_photos.append(s3_service.get_signed_url(char["reference_image_s3_key"], expires=3600))
    return char_photos


async def generate_nano_banana_video(scene: dict, job_id: str) -> str:
    """Generate a 5-second animated MP4 slideshow from Nano Banana frames using character references."""
    scene_id = scene["id"]
    scene_text = scene.get("scene_text", "") or scene.get("image_prompt", "")
    base_prompt = f"{scene_text[:300]}. High quality children's illustration, vibrant colors, child-friendly."

    # Fetch character reference photos for visual consistency
    char_photos = await _get_character_photos(scene.get("story_id", ""))
    if char_photos:
        logger.info(f"Using {len(char_photos)} character reference(s) for video frames")

    # 5 frame variants → 5 frames × 1fps = exactly 5 seconds
    frame_variants = [
        f"{base_prompt} Wide establishing shot showing the full scene.",
        f"{base_prompt} Characters in the center of the action.",
        f"{base_prompt} Close-up capturing emotion and expression.",
        f"{base_prompt} Dynamic moment with movement and energy.",
        f"{base_prompt} Resolution — calm and hopeful ending.",
    ]

    TARGET_SIZE = (640, 368)  # divisible by 16 for H.264 macro blocks
    frames = []

    # Use existing scene image as first frame if available
    existing_img = scene.get("image_url")
    if existing_img:
        try:
            resp = await asyncio.to_thread(requests.get, existing_img, timeout=30)
            if resp.status_code == 200:
                img = Image.open(BytesIO(resp.content)).convert("RGB").resize(TARGET_SIZE)
                frames.append(np.array(img))
        except Exception:
            pass

    for variant_prompt in frame_variants:
        if len(frames) >= 5:
            break
        try:
            results = await image_gen_service.generate_image(
                variant_prompt,
                aspect_ratio="16:9",
                reference_images=char_photos if char_photos else None
            )
            if results:
                _, result_data = results[0]
                img_bytes = base64.b64decode(result_data)
                img = Image.open(BytesIO(img_bytes)).convert("RGB").resize(TARGET_SIZE)
                frames.append(np.array(img))
        except Exception as e:
            logger.warning(f"Frame {len(frames)} generation failed: {e}")

    if not frames:
        raise Exception("No frames generated for video")

    # Exactly 5 frames → 5-second video at 1fps
    frames = frames[:5]
    while len(frames) < 5:
        frames.append(frames[-1])  # pad with last frame if fewer than 5

    buf = BytesIO()
    with imageio.get_writer(buf, format='mp4', fps=1, codec='libx264',
                            output_params=['-preset', 'ultrafast', '-pix_fmt', 'yuv420p']) as writer:
        for frame in frames:
            writer.append_data(frame)

    mp4_bytes = buf.getvalue()
    s3_key = f"videos/scenes/{scene_id}_{uuid.uuid4().hex[:8]}.mp4"
    video_url = await s3_service.upload(s3_key, mp4_bytes, "video/mp4")
    return video_url

async def run_scene_video_generation(scene_id: str, job_id: str, provider: str = "nano_banana"):
    try:
        scene = await db.scenes.find_one({"id": scene_id}, {"_id": 0})
        if not scene:
            raise Exception("Scene not found")

        logger.info(f"Generating video for scene {scene_id} via provider={provider}")
        video_url = None

        if provider == "minimax":
            await db.generation_jobs.update_one({"id": job_id}, {"$set": {"progress": 10, "message": "Sending to MiniMax Hailuo..."}})

            vid_prompt = scene.get("video_prompt") or scene.get("image_prompt", "")
            vid_prompt += ". Child-friendly, vibrant colors, cartoon style, smooth animation."
            if len(vid_prompt) > 2000:
                vid_prompt = vid_prompt[:2000]

            first_frame_url = scene.get("image_url")
            gen_type = "image-to-video" if first_frame_url else "text-to-video"
            logger.info(f"MiniMax video mode: {gen_type}")

            try:
                result = await minimax_service.generate_video(
                    vid_prompt,
                    first_frame_image=first_frame_url,
                    generation_type=gen_type
                )
                if result.get("url"):
                    s3_key = f"videos/scenes/{scene_id}_{uuid.uuid4().hex[:8]}.mp4"
                    video_url = await s3_service.upload_from_url(s3_key, result["url"], "video/mp4")
                    logger.info(f"MiniMax video complete for scene {scene_id}: {video_url}")
                else:
                    raise Exception("MiniMax returned no video URL")
            except Exception as mm_err:
                logger.warning(f"MiniMax video failed: {mm_err}. Falling back to Nano Banana...")
                await db.generation_jobs.update_one({"id": job_id}, {"$set": {"message": "MiniMax failed, falling back to Nano Banana..."}})
                video_url = await generate_nano_banana_video(scene, job_id)
                logger.info(f"Fallback Nano Banana video complete for scene {scene_id}: {video_url}")

        else:
            # Nano Banana (Gemini frames → imageio MP4)
            await db.generation_jobs.update_one({"id": job_id}, {"$set": {"progress": 10, "message": "Generating video frames with Nano Banana..."}})
            video_url = await generate_nano_banana_video(scene, job_id)
            logger.info(f"Nano Banana video complete for scene {scene_id}: {video_url}")

        if not video_url:
            raise Exception("No video URL produced by any provider")

        await db.scenes.update_one({"id": scene_id}, {"$set": {"video_url": video_url}})
        await db.generation_jobs.update_one({"id": job_id}, {"$set": {"status": "completed", "progress": 100}})

    except Exception as e:
        logger.error(f"Scene video generation failed: {e}")
        await db.generation_jobs.update_one({"id": job_id}, {"$set": {"status": "failed", "error_message": str(e)}})

def scene_video_task(scene_id: str, job_id: str, provider: str = "nano_banana"):
    asyncio.run(run_scene_video_generation(scene_id, job_id, provider))

@api_router.post("/stories/{story_id}/batch-generate-videos")
async def batch_generate_videos_v2(story_id: str, user: dict = Depends(get_current_user)):
    story = await db.stories.find_one({"id": story_id, "owner_id": user["id"]})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    scenes = await db.scenes.find({"story_id": story_id}, {"_id": 0}).to_list(100)
    scenes_with_images = [s for s in scenes if s.get("image_url")]
    if not scenes_with_images:
        raise HTTPException(status_code=400, detail="No scenes with images")
    job_id = str(uuid.uuid4())
    job_doc = {"id": job_id, "story_id": story_id, "user_id": user["id"], "job_type": "batch_scene_videos", "status": "pending", "progress": 0, "total_scenes": len(scenes_with_images), "completed_scenes": 0, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.generation_jobs.insert_one(job_doc)
    enqueue_task(batch_scene_videos_task, story_id, job_id, fallback_coro=run_batch_scene_videos)
    return {"job_id": job_id, "message": f"Queued {len(scenes_with_images)} scenes"}

async def run_batch_scene_videos(story_id: str, job_id: str):
    try:
        story = await db.stories.find_one({"id": story_id}, {"_id": 0})
        scenes = await db.scenes.find({"story_id": story_id}, {"_id": 0}).to_list(100)
        scenes_with_images = [s for s in scenes if s.get("image_url") and not s.get("video_url")]
        total = len(scenes_with_images)
        completed = 0
        preferred_provider = story.get("image_provider") or "nano_banana"
        logger.info(f"Batch video provider: {preferred_provider} for story {story_id}")
        for scene in scenes_with_images:
            try:
                await run_scene_video_generation(scene["id"], job_id, preferred_provider)
                completed += 1
                await db.generation_jobs.update_one({"id": job_id}, {"$set": {"progress": int((completed/total)*100), "completed_scenes": completed}})
            except Exception as e:
                logger.error(f"Failed: {e}")
        await db.generation_jobs.update_one({"id": job_id}, {"$set": {"status": "completed", "progress": 100}})
        try:
            user = await db.users.find_one({"id": story.get("owner_id")}, {"_id": 0})
            if user:
                frontend_url = os.environ.get('REACT_APP_BACKEND_URL', '').replace('/api', '')
                video_url = f"{frontend_url}/stories/{story_id}/edit"
                settings = await db.user_settings.find_one({"user_id": user["id"]}, {"_id": 0})
                await notify_video_complete(user_email=user.get("email"), parent_email=settings.get("parent_email") if settings else None, phone_number=user.get("phone"), story_title=story.get("title", "Your Story"), video_url=video_url)
        except Exception as e:
            logger.error(f"Notification failed: {e}")
    except Exception as e:
        await db.generation_jobs.update_one({"id": job_id}, {"$set": {"status": "failed", "error_message": str(e)}})

def batch_scene_videos_task(story_id: str, job_id: str):
    asyncio.run(run_batch_scene_videos(story_id, job_id))

@api_router.get("/notifications")
async def get_notifications_v2(user: dict = Depends(get_current_user)):
    jobs = await db.generation_jobs.find({"user_id": user["id"], "status": "completed", "job_type": {"$in": ["scene_video", "batch_scene_videos"]}}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    notifications = []
    for job in jobs:
        if job.get("job_type") == "batch_scene_videos":
            story = await db.stories.find_one({"id": job.get("story_id")}, {"_id": 0})
            notifications.append({"id": job["id"], "title": "Videos Ready! 🎬", "message": f"All videos for '{story.get('title', 'your story')}' are ready!", "read": False, "created_at": job.get("created_at")})
    return notifications


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


# ==================== TWINNEE AI CHATBOT ====================

from twinnee import TwinneeChat, get_user_behavior_context, update_behavior_scores

twinnee_chat = TwinneeChat()

class ChatMessage(BaseModel):
    message: str

class ActivityLog(BaseModel):
    activity_type: str  # 'learning', 'creative', 'story_created', 'task', 'screen_time', 'physical', 'social'
    duration_minutes: Optional[int] = 0
    completed: Optional[bool] = False
    choices_count: Optional[int] = 0
    metadata: Optional[dict] = {}


@api_router.post("/chat/message")
async def send_chat_message(body: ChatMessage, user: dict = Depends(get_current_user)):
    """Send message to TWINNEE chatbot with Responsible AI safety filter"""
    try:
        from responsible_ai import analyze_message_safety
        from parent_notifications import send_red_flag_alert

        user_id = user["id"]
        child_name = user.get("name", "your child")

        # Get conversation history
        conversations = await db.conversations.find(
            {"user_id": user_id}
        ).sort("timestamp", -1).limit(10).to_list(10)
        history = list(reversed(conversations))

        # ── 1. Responsible AI safety check ──
        safety = await analyze_message_safety(body.message, child_name, history)
        severity = safety.get("severity", "SAFE")

        # ── 2. Get user behavior context ──
        context = await get_user_behavior_context(db, user_id)

        # ── 3. Build modified TWINNEE response with gentle nudge if needed ──
        enhanced_message = body.message
        if safety.get("child_nudge") and severity in ("LOW", "MEDIUM", "HIGH", "CRITICAL"):
            # Append nudge instruction to context so TWINNEE weaves it in
            context["safety_nudge"] = safety["child_nudge"]
            context["safety_severity"] = severity

        bot_response = await twinnee_chat.get_response(
            enhanced_message,
            conversation_history=history,
            user_context=context
        )

        # For HIGH/CRITICAL: prepend a warm caring line to TWINNEE's response
        if severity in ("HIGH", "CRITICAL"):
            bot_response = f"{safety.get('child_nudge', 'I hear you, and I care about you so much!')} {bot_response}"

        # ── 4. Save conversation + safety flag ──
        conversation_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "user_message": body.message,
            "bot_response": bot_response,
            "safety_severity": severity,
            "safety_categories": safety.get("categories", []),
            "timestamp": datetime.now(timezone.utc)
        }
        await db.conversations.insert_one(conversation_doc)

        # ── 5. Store red flag if MEDIUM+ ──
        if severity in ("MEDIUM", "HIGH", "CRITICAL"):
            await db.red_flags.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "severity": severity,
                "categories": safety.get("categories", []),
                "summary": safety.get("summary", ""),
                "child_message": body.message,
                "parent_alerted": False,
                "timestamp": datetime.now(timezone.utc)
            })

        # ── 6. Notify parent for HIGH/CRITICAL (async, don't block response) ──
        if severity in ("HIGH", "CRITICAL") and safety.get("parent_alert"):
            settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
            parent_email = settings.get("parent_email") if settings else None
            parent_phone = settings.get("parent_phone") if settings else None
            if parent_email or parent_phone:
                try:
                    await send_red_flag_alert(
                        child_name=child_name,
                        severity=severity,
                        summary=safety.get("summary", "Concerning content detected"),
                        action_steps=safety.get("parent_action_steps", []),
                        child_message=body.message,
                        parent_email=parent_email,
                        parent_phone=parent_phone
                    )
                    await db.red_flags.update_one(
                        {"user_id": user_id, "child_message": body.message},
                        {"$set": {"parent_alerted": True}}
                    )
                except Exception as ne:
                    logger.error(f"Parent notification failed: {ne}")

        # ── 7. Log screen time ──
        await db.behavior_logs.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "activity_type": "screen_time",
            "duration_minutes": 1,
            "timestamp": datetime.now(timezone.utc)
        })

        await update_behavior_scores(db, user_id)

        return {
            "message": bot_response,
            "timestamp": conversation_doc["timestamp"].isoformat(),
            "safety_flag": severity if severity != "SAFE" else None
        }

    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/chat/history")
async def get_chat_history(limit: int = 20, user: dict = Depends(get_current_user)):
    """Get chat conversation history"""
    conversations = await db.conversations.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)

    return {"conversations": list(reversed(conversations))}


@api_router.post("/behavior/log-activity")
async def log_activity(body: ActivityLog, user: dict = Depends(get_current_user)):
    """Log user behavior activity"""
    try:
        activity_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "activity_type": body.activity_type,
            "duration_minutes": body.duration_minutes,
            "completed": body.completed,
            "choices_count": body.choices_count,
            "metadata": body.metadata,
            "timestamp": datetime.now(timezone.utc)
        }
        await db.behavior_logs.insert_one(activity_doc)

        # Update scores
        await update_behavior_scores(db, user["id"])

        return {"status": "logged", "activity_id": activity_doc["id"]}

    except Exception as e:
        logger.error(f"Activity log error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/behavior/scores")
async def get_behavior_scores(user: dict = Depends(get_current_user)):
    """Get user's behavior scores (for parent dashboard)"""
    try:
        # Update scores first
        scores = await update_behavior_scores(db, user["id"])

        # Get score document
        scores_doc = await db.user_scores.find_one({"user_id": user["id"]}, {"_id": 0})

        if not scores_doc:
            return {
                "scores": {
                    "learning": 50, "creativity": 50, "discipline": 50,
                    "emotional": 75, "physical": 50, "social": 60,
                    "overall": 55
                },
                "screen_time_week": 0,
                "last_updated": datetime.now(timezone.utc).isoformat()
            }

        return {
            "scores": scores_doc.get("scores", {}),
            "screen_time_week": scores_doc.get("screen_time_week", 0),
            "last_updated": scores_doc.get("last_updated", datetime.now(timezone.utc)).isoformat() if scores_doc.get("last_updated") else datetime.now(timezone.utc).isoformat()
        }

    except Exception as e:
        logger.error(f"Behavior scores error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/twinnee/story-suggestions")
async def get_story_suggestions(user: dict = Depends(get_current_user)):
    """Get personalized story suggestions based on behavior"""
    try:
        from twinnee import StoryPersonalizer, PatternLearner

        # Get user scores
        scores_doc = await db.user_scores.find_one({"user_id": user["id"]}, {"_id": 0})
        scores = scores_doc.get('scores', {}) if scores_doc else {}

        # Get patterns
        patterns = await PatternLearner.get_patterns(db, user["id"])

        # Get user interests (could be from profile)
        user_doc = await db.users.find_one({"id": user["id"]}, {"_id": 0})
        interests = user_doc.get('interests', [])

        # Get suggestions
        suggestions = StoryPersonalizer.get_story_suggestions(scores, patterns, interests)

        return {"suggestions": suggestions, "patterns": patterns}

    except Exception as e:
        logger.error(f"Story suggestions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/twinnee/patterns")
async def get_user_patterns(user: dict = Depends(get_current_user)):
    """Get learned patterns for user (for parent dashboard)"""
    try:
        from twinnee import PatternLearner


        patterns = await PatternLearner.get_patterns(db, user["id"], days=30)

        return {
            "patterns": patterns,
            "insights": {
                "most_active_time": patterns['peak_activity_times'][0] if patterns['peak_activity_times'] else None,
                "top_interests": [c[0] for c in patterns['favorite_content'][:3]] if patterns['favorite_content'] else [],
                "avg_attention_span": round(patterns['average_attention_span'], 1) if patterns['average_attention_span'] else 0
            }
        }

    except Exception as e:
        logger.error(f"Patterns error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/twinnee/risk-check")
async def check_behavioral_risks(user: dict = Depends(get_current_user)):
    """Check for behavioral risks (for parent dashboard)"""
    try:
        from twinnee import BehavioralRiskDetector, get_user_behavior_context

        # Get context
        context = await get_user_behavior_context(db, user["id"])

        # Get activities
        week_ago = datetime.now(timezone.utc) - timedelta(days=7)
        activities = await db.behavior_logs.find(
            {"user_id": user["id"], "timestamp": {"$gte": week_ago}}
        ).to_list(1000)

        # Detect risks
        risk_detector = BehavioralRiskDetector()
        risks = risk_detector.detect_risks(context, activities)

        # Filter to only show parent-flagged risks
        parent_risks = [r for r in risks if r.get('parent_alert')]

        return {
            "risks": parent_risks,
            "total_risks": len(risks),
            "context_summary": {
                "screen_time_today": context.get("screen_time_today", 0),
                "emotional_score": context.get("scores", {}).get("emotional", 75)
            }
        }

    except Exception as e:
        logger.error(f"Risk check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== PARENT INTELLIGENCE CENTRE ====================

@api_router.get("/parent/child-analysis")
async def get_child_analysis(user: dict = Depends(get_current_user)):
    """
    AI-powered analysis of child's recent conversations + behavior.
    Returns emotional status, next steps for parents, red flags summary.
    """
    try:
        from responsible_ai import generate_child_analysis_report
        user_id = user["id"]
        child_name = user.get("name", "your child")

        # Get last 30 conversations
        week_ago = datetime.now(timezone.utc) - timedelta(days=7)
        conversations = await db.conversations.find(
            {"user_id": user_id, "timestamp": {"$gte": week_ago}},
            {"_id": 0}
        ).sort("timestamp", -1).limit(30).to_list(30)

        # Get current scores
        scores_doc = await db.user_scores.find_one({"user_id": user_id}, {"_id": 0})
        scores = scores_doc.get("scores", {}) if scores_doc else {}

        # Get recent red flags
        red_flags = await db.red_flags.find(
            {"user_id": user_id, "timestamp": {"$gte": week_ago}},
            {"_id": 0}
        ).sort("timestamp", -1).to_list(20)

        for f in red_flags:
            if isinstance(f.get("timestamp"), datetime):
                f["timestamp"] = f["timestamp"].isoformat()

        analysis = await generate_child_analysis_report(
            child_name=child_name,
            conversations=list(reversed(conversations)),
            scores=scores,
            red_flags=red_flags
        )

        return {
            "analysis": analysis,
            "red_flags": red_flags,
            "red_flag_count": len(red_flags),
            "has_critical": any(f.get("severity") == "CRITICAL" for f in red_flags),
            "has_high": any(f.get("severity") == "HIGH" for f in red_flags),
        }
    except Exception as e:
        logger.error(f"Child analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/parent/red-flags")
async def get_red_flags(user: dict = Depends(get_current_user)):
    """Get all red flag incidents for this user."""
    try:
        user_id = user["id"]
        flags = await db.red_flags.find(
            {"user_id": user_id},
            {"_id": 0}
        ).sort("timestamp", -1).limit(50).to_list(50)
        for f in flags:
            if isinstance(f.get("timestamp"), datetime):
                f["timestamp"] = f["timestamp"].isoformat()
        return {"red_flags": flags, "total": len(flags)}
    except Exception as e:
        logger.error(f"Red flags error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class WeeklyReportBody(BaseModel):
    force: bool = False


@api_router.post("/parent/send-weekly-report")
async def send_weekly_report(body: WeeklyReportBody, user: dict = Depends(get_current_user)):
    """Generate and send weekly behavior report via email + WhatsApp."""
    try:
        from responsible_ai import generate_weekly_report
        from parent_notifications import send_weekly_report_notification

        user_id = user["id"]
        child_name = user.get("name", "your child")

        settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
        parent_email = settings.get("parent_email") if settings else None
        parent_phone = settings.get("parent_phone") if settings else None

        if not parent_email and not parent_phone:
            raise HTTPException(
                status_code=400,
                detail="No parent email or phone configured. Add them in Settings first."
            )

        # Gather data
        week_ago = datetime.now(timezone.utc) - timedelta(days=7)
        conversations = await db.conversations.find(
            {"user_id": user_id, "timestamp": {"$gte": week_ago}},
            {"_id": 0}
        ).sort("timestamp", 1).limit(50).to_list(50)

        scores_doc = await db.user_scores.find_one({"user_id": user_id}, {"_id": 0})
        scores = scores_doc.get("scores", {}) if scores_doc else {}

        red_flags = await db.red_flags.find(
            {"user_id": user_id, "timestamp": {"$gte": week_ago}},
            {"_id": 0}
        ).to_list(20)
        for f in red_flags:
            if isinstance(f.get("timestamp"), datetime):
                f["timestamp"] = f["timestamp"].isoformat()

        behavior_logs = await db.behavior_logs.find(
            {"user_id": user_id, "timestamp": {"$gte": week_ago}},
            {"_id": 0}
        ).to_list(200)

        # Generate the report text
        report_text = await generate_weekly_report(
            child_name=child_name,
            conversations=conversations,
            scores=scores,
            red_flags=red_flags,
            behavior_logs=behavior_logs
        )

        result = await send_weekly_report_notification(
            child_name=child_name,
            report_text=report_text,
            parent_email=parent_email,
            parent_phone=parent_phone,
            scores=scores
        )

        return {"success": True, "sent_to": result, "report_preview": report_text[:300]}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Weekly report error: {e}")
        raise HTTPException(status_code=500, detail=str(e))




from social import FriendSystem, CollaborativeSession, InteractionLogger, InteractionAnalyzer

class FriendRequestBody(BaseModel):
    to_user_id: str

class FriendResponseBody(BaseModel):
    request_id: str
    action: str  # 'accept' or 'decline'

class CollabCreateBody(BaseModel):
    friend_id: str
    topic: str

class CollabContributeBody(BaseModel):
    session_id: str
    contribution: str


@api_router.post("/friends/request")
async def send_friend_request(body: FriendRequestBody, user: dict = Depends(get_current_user)):
    """Send a friend request"""
    try:
        result = await FriendSystem.send_friend_request(db, user["id"], body.to_user_id)
        return result
    except Exception as e:
        logger.error(f"Friend request error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/friends/respond")
async def respond_friend_request(body: FriendResponseBody, user: dict = Depends(get_current_user)):
    """Parent approves or declines friend request"""
    try:
        # Verify the request is for this user
        request = await db.friend_requests.find_one({"id": body.request_id})
        if not request or request["to_user_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")

        success = await FriendSystem.respond_to_request(db, body.request_id, body.action)
        return {"success": success}
    except Exception as e:
        logger.error(f"Friend response error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/friends/list")
async def get_friends_list(user: dict = Depends(get_current_user)):
    """Get user's friend list"""
    try:
        friends = await FriendSystem.get_friends(db, user["id"])
        return {"friends": friends}
    except Exception as e:
        logger.error(f"Get friends error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/friends/requests")
async def get_friend_requests(user: dict = Depends(get_current_user)):
    """Get pending friend requests"""
    try:
        # Incoming requests
        incoming = await db.friend_requests.find({
            "to_user_id": user["id"],
            "status": "pending"
        }, {"_id": 0}).to_list(50)

        # Outgoing requests
        outgoing = await db.friend_requests.find({
            "from_user_id": user["id"],
            "status": "pending"
        }, {"_id": 0}).to_list(50)

        # Get user details for incoming requests
        for req in incoming:
            from_user = await db.users.find_one({"id": req["from_user_id"]}, {"_id": 0, "password": 0})
            req["from_user"] = from_user

        return {
            "incoming": incoming,
            "outgoing": outgoing
        }
    except Exception as e:
        logger.error(f"Get requests error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/friends/search")
async def search_users(query: str, user: dict = Depends(get_current_user)):
    """Search for users"""
    try:
        if not query or len(query) < 2:
            return {"users": []}

        users = await FriendSystem.search_users(db, query, user["id"])
        return {"users": users}
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/collab/create")
async def create_collaboration(body: CollabCreateBody, user: dict = Depends(get_current_user)):
    """Create a collaborative story session"""
    try:
        # Verify friendship
        friendship = await db.friendships.find_one({
            "$or": [
                {"user1_id": user["id"], "user2_id": body.friend_id},
                {"user1_id": body.friend_id, "user2_id": user["id"]}
            ]
        })

        if not friendship:
            raise HTTPException(status_code=403, detail="Not friends")

        session = await CollaborativeSession.create_session(
            db, user["id"], body.friend_id, body.topic
        )

        # Update friendship collaboration count
        await db.friendships.update_one(
            {"id": friendship["id"]},
            {
                "$inc": {"collaboration_count": 1},
                "$set": {"last_collaboration": datetime.now(timezone.utc)}
            }
        )

        return {"session": session}
    except Exception as e:
        logger.error(f"Create collab error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/collab/contribute")
async def contribute_to_collab(body: CollabContributeBody, user: dict = Depends(get_current_user)):
    """Add contribution to collaborative session"""
    try:
        result = await CollaborativeSession.take_turn(
            db, body.session_id, user["id"], body.contribution
        )

        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])

        return result
    except Exception as e:
        logger.error(f"Contribute error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/collab/session/{session_id}")
async def get_collaboration_session(session_id: str, user: dict = Depends(get_current_user)):
    """Get collaborative session details"""
    try:
        session = await CollaborativeSession.get_session(db, session_id)

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Verify user is participant
        if user["id"] not in session["participants"]:
            raise HTTPException(status_code=403, detail="Not authorized")

        # Get participant details
        participants_data = []
        for p_id in session["participants"]:
            p_user = await db.users.find_one({"id": p_id}, {"_id": 0, "password": 0})
            if p_user:
                participants_data.append({
                    "id": p_user["id"],
                    "name": p_user.get("name", "User")
                })

        session["participants_data"] = participants_data

        return {"session": session}
    except Exception as e:
        logger.error(f"Get session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/collab/my-sessions")
async def get_my_sessions(user: dict = Depends(get_current_user)):
    """Get user's collaborative sessions"""
    try:
        sessions = await db.collab_sessions.find({
            "participants": user["id"]
        }, {"_id": 0}).sort("last_activity", -1).to_list(50)

        # Add participant names to each session
        for session in sessions:
            participants_data = []
            for p_id in session.get("participants", []):
                p_user = await db.users.find_one({"id": p_id}, {"_id": 0, "password": 0})
                if p_user:
                    participants_data.append({
                        "id": p_user["id"],
                        "name": p_user.get("name", "User")
                    })
            session["participants_data"] = participants_data

        return {"sessions": sessions}
    except Exception as e:
        logger.error(f"Get sessions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class CollabChatBody(BaseModel):
    session_id: str
    message: str
    is_story_contribution: bool = False


@api_router.post("/collab/chat")
async def send_collab_chat_message(body: CollabChatBody, user: dict = Depends(get_current_user)):
    """Send a chat message in collaborative session"""
    try:
        session = await db.collab_sessions.find_one({"id": body.session_id})

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        if user["id"] not in session["participants"]:
            raise HTTPException(status_code=403, detail="Not authorized")

        # Create chat message
        chat_msg = {
            "id": str(uuid.uuid4()),
            "sender_id": user["id"],
            "sender_name": user.get("name", "User"),
            "message": body.message,
            "is_story_contribution": body.is_story_contribution,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        # Add to session chat history
        await db.collab_sessions.update_one(
            {"id": body.session_id},
            {
                "$push": {"chat_messages": chat_msg},
                "$set": {"last_activity": datetime.now(timezone.utc)}
            }
        )

        # If it's a story contribution, also add to story content
        if body.is_story_contribution:
            turn_num = session.get("turn_count", 0) + 1
            story_contribution = {
                "contributor": user["id"],
                "contributor_name": user.get("name", "User"),
                "text": body.message,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "turn": turn_num
            }

            # Switch turns
            other_user = [u for u in session["participants"] if u != user["id"]][0]

            await db.collab_sessions.update_one(
                {"id": body.session_id},
                {
                    "$push": {"story.content": story_contribution},
                    "$set": {
                        "current_turn": other_user,
                        "turn_count": turn_num
                    }
                }
            )

        return {"success": True, "message": chat_msg}
    except Exception as e:
        logger.error(f"Chat message error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/collab/chat/{session_id}")
async def get_collab_chat_messages(session_id: str, user: dict = Depends(get_current_user)):
    """Get chat messages for a collaborative session"""
    try:
        session = await db.collab_sessions.find_one({"id": session_id}, {"_id": 0})

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        if user["id"] not in session["participants"]:
            raise HTTPException(status_code=403, detail="Not authorized")

        return {
            "messages": session.get("chat_messages", []),
            "story_content": session.get("story", {}).get("content", []),
            "current_turn": session.get("current_turn"),
            "turn_count": session.get("turn_count", 0)
        }
    except Exception as e:
        logger.error(f"Get chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/collab/complete/{session_id}")
async def complete_collaboration(session_id: str, user: dict = Depends(get_current_user)):
    """Mark collaboration as complete and generate reports"""
    try:
        session = await db.collab_sessions.find_one({"id": session_id})

        if not session or user["id"] not in session["participants"]:
            raise HTTPException(status_code=403, detail="Not authorized")

        await CollaborativeSession.complete_session(db, session_id)

        return {"success": True, "message": "Reports generated"}
    except Exception as e:
        logger.error(f"Complete session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/collab/report/{session_id}")
async def get_collaboration_report(session_id: str, user: dict = Depends(get_current_user)):
    """Get user's collaboration report"""
    try:
        report = await db.collab_reports.find_one({
            "session_id": session_id,
            "user_id": user["id"]
        }, {"_id": 0})

        if not report:
            raise HTTPException(status_code=404, detail="Report not found")

        return {"report": report}
    except Exception as e:
        logger.error(f"Get report error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== TIMELINE & SOCIAL ====================

class CreatePostBody(BaseModel):
    content: str
    image: Optional[str] = None  # base64 image


@api_router.get("/timeline/posts")
async def get_timeline_posts(user: dict = Depends(get_current_user)):
    """Get posts for timeline - all posts from users"""
    try:
        posts = await db.posts.find({}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)

        # Add author info and like status
        for post in posts:
            author = await db.users.find_one({"id": post.get("author_id")}, {"_id": 0, "password": 0})
            post["author_name"] = author.get("name", "User") if author else "User"

            # Check if current user liked this post
            post["liked"] = user["id"] in post.get("liked_by", [])
            post["likes_count"] = len(post.get("liked_by", []))
            post["comments_count"] = len(post.get("comments", []))

            # Convert datetime to ISO string
            if post.get("created_at"):
                post["created_at"] = post["created_at"].isoformat() if hasattr(post["created_at"], 'isoformat') else post["created_at"]

        return {"posts": posts}
    except Exception as e:
        logger.error(f"Get timeline posts error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/timeline/posts")
async def create_post(body: CreatePostBody, user: dict = Depends(get_current_user)):
    """Create a new post"""
    try:
        post_id = str(uuid.uuid4())
        image_url = None

        # Upload image if provided
        if body.image:
            img_bytes = base64.b64decode(body.image)
            img_key = f"posts/{post_id}/{uuid.uuid4().hex[:8]}.png"
            image_url = await s3_service.upload(img_key, img_bytes, 'image/png')

        post_doc = {
            "id": post_id,
            "author_id": user["id"],
            "content": body.content,
            "image_url": image_url,
            "liked_by": [],
            "comments": [],
            "created_at": datetime.now(timezone.utc)
        }

        await db.posts.insert_one(post_doc)

        # Return without _id
        result = {k: v for k, v in post_doc.items() if k != "_id"}
        result["created_at"] = result["created_at"].isoformat()
        result["author_name"] = user.get("name", "User")
        result["likes_count"] = 0
        result["comments_count"] = 0
        result["liked"] = False

        return {"post": result}
    except Exception as e:
        logger.error(f"Create post error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/timeline/posts/{post_id}/like")
async def like_post(post_id: str, user: dict = Depends(get_current_user)):
    """Like or unlike a post"""
    try:
        post = await db.posts.find_one({"id": post_id})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")

        liked_by = post.get("liked_by", [])

        if user["id"] in liked_by:
            # Unlike
            await db.posts.update_one(
                {"id": post_id},
                {"$pull": {"liked_by": user["id"]}}
            )
            return {"liked": False}
        else:
            # Like
            await db.posts.update_one(
                {"id": post_id},
                {"$addToSet": {"liked_by": user["id"]}}
            )
            return {"liked": True}
    except Exception as e:
        logger.error(f"Like post error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/timeline/suggested-users")
async def get_suggested_users(user: dict = Depends(get_current_user)):
    """Get suggested users to connect with"""
    try:
        # Get user's existing friends
        friendships = await db.friendships.find({
            "$or": [{"user1_id": user["id"]}, {"user2_id": user["id"]}]
        }).to_list(100)

        friend_ids = set()
        for f in friendships:
            friend_ids.add(f["user1_id"])
            friend_ids.add(f["user2_id"])
        friend_ids.add(user["id"])  # Exclude self

        # Get pending requests
        pending = await db.friend_requests.find({
            "$or": [{"from_user_id": user["id"]}, {"to_user_id": user["id"]}],
            "status": "pending"
        }).to_list(100)

        for p in pending:
            friend_ids.add(p["from_user_id"])
            friend_ids.add(p["to_user_id"])

        # Get users not in friends list
        suggested = await db.users.find(
            {"id": {"$nin": list(friend_ids)}},
            {"_id": 0, "password": 0}
        ).limit(5).to_list(5)

        return {"users": suggested}
    except Exception as e:
        logger.error(f"Get suggested users error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== DIRECT CHAT ====================

class DirectMessageBody(BaseModel):
    friend_id: str
    message: str


@api_router.post("/chat/direct/start")
async def start_direct_chat(body: dict, user: dict = Depends(get_current_user)):
    """Start or get existing direct chat with a friend"""
    try:
        friend_id = body.get("friend_id")

        # Check if chat exists
        chat = await db.direct_chats.find_one({
            "$or": [
                {"user1_id": user["id"], "user2_id": friend_id},
                {"user1_id": friend_id, "user2_id": user["id"]}
            ]
        })

        if chat:
            return {"chat_id": chat["id"]}

        # Create new chat
        chat_id = str(uuid.uuid4())
        chat_doc = {
            "id": chat_id,
            "user1_id": user["id"],
            "user2_id": friend_id,
            "messages": [],
            "created_at": datetime.now(timezone.utc)
        }

        await db.direct_chats.insert_one(chat_doc)
        return {"chat_id": chat_id}
    except Exception as e:
        logger.error(f"Start direct chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/chat/direct/send")
async def send_direct_message(body: DirectMessageBody, user: dict = Depends(get_current_user)):
    """Send a direct message to a friend"""
    try:
        # Find the chat
        chat = await db.direct_chats.find_one({
            "$or": [
                {"user1_id": user["id"], "user2_id": body.friend_id},
                {"user1_id": body.friend_id, "user2_id": user["id"]}
            ]
        })

        if not chat:
            # Create chat if doesn't exist
            chat_id = str(uuid.uuid4())
            chat = {
                "id": chat_id,
                "user1_id": user["id"],
                "user2_id": body.friend_id,
                "messages": [],
                "created_at": datetime.now(timezone.utc)
            }
            await db.direct_chats.insert_one(chat)

        # Add message
        message = {
            "id": str(uuid.uuid4()),
            "sender_id": user["id"],
            "sender_name": user.get("name", "User"),
            "message": body.message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        await db.direct_chats.update_one(
            {"id": chat["id"]},
            {"$push": {"messages": message}}
        )

        return {"success": True, "message": message}
    except Exception as e:
        logger.error(f"Send direct message error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/chat/direct/{friend_id}")
async def get_direct_messages(friend_id: str, user: dict = Depends(get_current_user)):
    """Get direct messages with a friend"""
    try:
        chat = await db.direct_chats.find_one({
            "$or": [
                {"user1_id": user["id"], "user2_id": friend_id},
                {"user1_id": friend_id, "user2_id": user["id"]}
            ]
        }, {"_id": 0})

        if not chat:
            return {"messages": []}

        return {"messages": chat.get("messages", [])}
    except Exception as e:
        logger.error(f"Get direct messages error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== APP SETUP ====================
# Include router AFTER all routes are defined
app.include_router(api_router)

