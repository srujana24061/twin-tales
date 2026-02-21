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
import tempfile
import shutil
import subprocess
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
CELERY_BROKER_URL = os.environ["CELERY_BROKER_URL"]
CELERY_RESULT_BACKEND = os.environ["CELERY_RESULT_BACKEND"]
CELERY_TASK_ALWAYS_EAGER = os.environ["CELERY_TASK_ALWAYS_EAGER"].lower() == "true"

celery_app = Celery("storycraft", broker=CELERY_BROKER_URL, backend=CELERY_RESULT_BACKEND)
celery_app.conf.update(task_always_eager=CELERY_TASK_ALWAYS_EAGER, task_eager_propagates=True)

# Initialize external services
from services import S3Service, MiniMaxService, ElevenLabsService, EdgeTTSService, GeminiImageService, FotorService
s3_service = S3Service()
minimax_service = MiniMaxService()
image_gen_service = GeminiImageService()
elevenlabs_service = ElevenLabsService()
edge_tts_service = EdgeTTSService()
fotor_service = FotorService()

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
    music_asset = await db.media_assets.find_one({"story_id": story_id, "type": "music"}, {"_id": 0, "id": 1})
    if music_asset:
        story["music_url"] = f"/api/media/{music_asset['id']}"
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


async def generate_scene_image(img_prompt: str, aspect_ratio: str, reference_images: list, preferred_provider: str = "nano_banana"):
    provider_order = ["nano_banana", "minimax"] if preferred_provider != "minimax" else ["minimax", "nano_banana"]
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
            logger.warning(f"Image generation failed using {provider}: {e}")
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
    tmpdir = tempfile.mkdtemp(prefix="storycraft_export_")
    try:
        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "running", "progress": 5, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

        story = await db.stories.find_one({"id": story_id}, {"_id": 0})
        scenes_raw = await db.scenes.find({"story_id": story_id}, {"_id": 0}).sort("scene_number", 1).to_list(100)
        scenes = [s for s in scenes_raw if s.get("include_in_video", True)]
        user_id = story.get("owner_id", "unknown")

        if not scenes:
            raise Exception("No scenes to export")

        scene_videos = []

        for i, scene in enumerate(scenes):
            scene_dir = os.path.join(tmpdir, f"scene_{i}")
            os.makedirs(scene_dir, exist_ok=True)

            duration = scene.get("duration_seconds") or DEFAULT_SCENE_DURATION
            duration = max(1, float(duration))
            trim_start = max(0, float(scene.get("trim_start_seconds") or 0))
            trim_end = scene.get("trim_end_seconds")
            if trim_end is not None:
                trim_end = float(trim_end)
                if trim_end > trim_start:
                    duration = max(0.5, trim_end - trim_start)

            transition_type = scene.get("transition_type", "cut")
            has_video = False
            has_image = False
            has_audio = False

            if scene.get("video_url"):
                vid_path = os.path.join(scene_dir, "video.mp4")
                has_video = await download_media_file(scene["video_url"], vid_path)

            if scene.get("image_url"):
                img_path = os.path.join(scene_dir, "image.png")
                has_image = await download_media_file(scene["image_url"], img_path)

            if scene.get("audio_url"):
                aud_path = os.path.join(scene_dir, "narration.mp3")
                has_audio = await download_media_file(scene["audio_url"], aud_path)

            out_path = os.path.join(scene_dir, "output.mp4")
            if not (has_video or has_image):
                continue

            input_cmd = ["ffmpeg", "-y"]
            if trim_start > 0 and has_video:
                input_cmd += ["-ss", str(trim_start)]

            if has_video:
                input_cmd += ["-i", vid_path]
            else:
                input_cmd += ["-loop", "1", "-i", img_path]

            if has_audio:
                input_cmd += ["-i", aud_path]
            else:
                input_cmd += ["-f", "lavfi", "-t", str(duration), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"]

            input_cmd += ["-t", str(duration)]

            vfilter = "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1"
            afilter = "aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo"

            if transition_type == "fade" and duration > TRANSITION_FADE_SECONDS * 2:
                fade_out_start = max(0.1, duration - TRANSITION_FADE_SECONDS)
                vfilter += f",fade=t=in:st=0:d={TRANSITION_FADE_SECONDS},fade=t=out:st={fade_out_start}:d={TRANSITION_FADE_SECONDS}"
                afilter += f",afade=t=in:st=0:d={TRANSITION_FADE_SECONDS},afade=t=out:st={fade_out_start}:d={TRANSITION_FADE_SECONDS}"

            cmd = input_cmd + [
                "-filter_complex", f"[0:v]{vfilter}[v];[1:a]{afilter}[a]",
                "-map", "[v]", "-map", "[a]",
                "-c:v", "libx264", "-c:a", "aac", "-pix_fmt", "yuv420p", "-shortest",
                out_path
            ]

            logger.info(f"FFmpeg scene {i+1}: {' '.join(cmd[:8])}...")
            result = await asyncio.to_thread(
                subprocess.run, cmd, capture_output=True, text=True, timeout=180
            )
            if result.returncode != 0:
                logger.error(f"FFmpeg scene {i+1} error: {result.stderr[:500]}")
                continue

            if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
                scene_videos.append(out_path)

            progress = 5 + int((i + 1) / len(scenes) * 60)
            await db.generation_jobs.update_one(
                {"id": job_id},
                {"$set": {"progress": progress, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )

        if not scene_videos:
            raise Exception("No scene videos produced")

        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"progress": 70, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

        concat_list = os.path.join(tmpdir, "concat.txt")
        with open(concat_list, 'w') as f:
            for vp in scene_videos:
                f.write(f"file '{vp}'\n")

        combined_path = os.path.join(tmpdir, "combined.mp4")
        concat_cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", concat_list,
                      "-c:v", "libx264", "-c:a", "aac", "-pix_fmt", "yuv420p", combined_path]
        result = await asyncio.to_thread(subprocess.run, concat_cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            logger.error(f"FFmpeg concat error: {result.stderr[:500]}")
            raise Exception("Video concatenation failed")

        final_path = combined_path
        music_asset = await db.media_assets.find_one({"story_id": story_id, "type": "music"}, {"_id": 0})
        if music_asset:
            music_path = os.path.join(tmpdir, "bg_music.mp3")
            has_music = False
            if music_asset.get("s3_key"):
                try:
                    url = s3_service.get_signed_url(music_asset["s3_key"])
                    resp = await asyncio.to_thread(http_requests.get, url, timeout=60)
                    if resp.status_code == 200:
                        with open(music_path, 'wb') as f:
                            f.write(resp.content)
                        has_music = True
                except Exception:
                    pass
            elif music_asset.get("data"):
                with open(music_path, 'wb') as f:
                    f.write(base64.b64decode(music_asset["data"]))
                has_music = True

            if has_music:
                final_with_music = os.path.join(tmpdir, "final.mp4")
                music_cmd = ["ffmpeg", "-y", "-i", combined_path, "-i", music_path,
                             "-filter_complex", "[1:a]volume=0.15[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=3[aout]",
                             "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac",
                             final_with_music]
                result = await asyncio.to_thread(subprocess.run, music_cmd, capture_output=True, text=True, timeout=300)
                if result.returncode == 0 and os.path.exists(final_with_music):
                    final_path = final_with_music

        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"progress": 90, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

        with open(final_path, 'rb') as f:
            video_bytes = f.read()

        asset_id = str(uuid.uuid4())
        s3_key = f"users/{user_id}/stories/{story_id}/exports/final_{asset_id[:8]}.mp4"
        try:
            s3_url = await s3_service.upload(s3_key, video_bytes, 'video/mp4')
            await db.media_assets.insert_one({
                "id": asset_id, "type": "video", "format": "mp4",
                "s3_key": s3_key, "s3_url": s3_url, "story_id": story_id,
                "is_export": True, "created_at": datetime.now(timezone.utc).isoformat()
            })
        except Exception:
            image_b64 = base64.b64encode(video_bytes).decode('utf-8')
            await db.media_assets.insert_one({
                "id": asset_id, "type": "video", "format": "mp4",
                "data": image_b64, "story_id": story_id,
                "is_export": True, "created_at": datetime.now(timezone.utc).isoformat()
            })

        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {
                "status": "completed", "progress": 100,
                "result_url": f"/api/media/{asset_id}",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        logger.info(f"FFmpeg export completed for story {story_id}")

    except Exception as e:
        logger.error(f"FFmpeg export failed: {e}")
        await db.generation_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "failed", "error_message": str(e), "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
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

        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"ad-{story_id}-{uuid.uuid4().hex[:8]}",
            system_message="You are an expert social media marketing copywriter for children's content. Return ONLY valid JSON."
        ).with_model("openai", "gpt-5.2")

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

        response = await chat.send_message(UserMessage(text=prompt))
        ad_data = parse_json_response(response)

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
