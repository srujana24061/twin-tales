import os
import boto3
import requests
import asyncio
import logging
import base64
import uuid
import edge_tts
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

logger = logging.getLogger(__name__)

# Edge TTS voice map (voice_style → Microsoft Edge voice)
EDGE_TTS_VOICES = {
    "child": "en-US-AnaNeural",           # Young girl voice
    "female": "en-US-AriaNeural",          # Warm female narrator
    "male": "en-US-GuyNeural",             # Deep male narrator
    "storyteller": "en-US-JennyNeural",    # Expressive storyteller
}

# ElevenLabs voice map (fallback if ElevenLabs works)
ELEVENLABS_VOICES = {
    "child": "EXAVITQu4vr4xnSDxMaL",
    "female": "21m00Tcm4TlvDq8ikWAM",
    "male": "TxGEqnHWrfWFTfGW9XjX",
    "storyteller": "pNInz6obpgDQGcFmaJgB",
}


class EdgeTTSService:
    """Free TTS using Microsoft Edge voices — no API key needed."""

    async def generate_tts(self, text: str, voice_style: str = "storyteller") -> bytes:
        voice = EDGE_TTS_VOICES.get(voice_style, EDGE_TTS_VOICES["storyteller"])
        communicate = edge_tts.Communicate(text[:5000], voice)
        audio_data = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]
        if not audio_data:
            raise Exception("Edge TTS: empty audio response")
        logger.info(f"Edge TTS generated: {len(audio_data)} bytes, voice={voice}")
        return audio_data


class ElevenLabsService:
    """ElevenLabs TTS — requires paid API key."""

    def __init__(self):
        self.api_key = os.environ.get('ELEVENLABS_API_KEY')
        self.client = None
        if self.api_key:
            try:
                from elevenlabs import ElevenLabs
                self.client = ElevenLabs(api_key=self.api_key)
            except Exception:
                pass

    async def generate_tts(self, text: str, voice_style: str = "storyteller") -> bytes:
        if not self.client:
            raise Exception("ElevenLabs not available")
        from elevenlabs import VoiceSettings
        voice_id = ELEVENLABS_VOICES.get(voice_style, ELEVENLABS_VOICES["storyteller"])

        def _generate():
            audio_gen = self.client.text_to_speech.convert(
                text=text[:5000], voice_id=voice_id,
                model_id="eleven_multilingual_v2",
                voice_settings=VoiceSettings(stability=0.7, similarity_boost=0.8, style=0.3, use_speaker_boost=True)
            )
            data = b""
            for chunk in audio_gen:
                data += chunk
            return data

        audio_bytes = await asyncio.to_thread(_generate)
        if not audio_bytes:
            raise Exception("ElevenLabs: empty audio")
        logger.info(f"ElevenLabs TTS: {len(audio_bytes)} bytes")
        return audio_bytes


class S3Service:
    def __init__(self):
        self.s3 = boto3.client(
            's3',
            region_name=os.environ.get('AWS_REGION'),
            aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY')
        )
        self.bucket = os.environ.get('AWS_STORAGE_BUCKET_NAME')
        self.region = os.environ.get('AWS_REGION')

    async def upload(self, key: str, data: bytes, content_type: str = 'image/png') -> str:
        await asyncio.to_thread(
            self.s3.put_object,
            Bucket=self.bucket,
            Key=key,
            Body=data,
            ContentType=content_type
        )
        url = self.s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': self.bucket, 'Key': key},
            ExpiresIn=604800
        )
        return url

    async def upload_from_url(self, key: str, source_url: str, content_type: str = 'image/png') -> str:
        resp = await asyncio.to_thread(requests.get, source_url, timeout=120)
        if resp.status_code != 200:
            raise Exception(f"Failed to download from {source_url}: {resp.status_code}")
        return await self.upload(key, resp.content, content_type)

    def get_signed_url(self, key: str, expires: int = 604800) -> str:
        return self.s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': self.bucket, 'Key': key},
            ExpiresIn=expires
        )


class GeminiImageService:
    def __init__(self):
        self.api_key = os.environ.get('EMERGENT_LLM_KEY')
        self.model_id = "gemini-3-pro-image-preview"
        self.style_model_id = "gemini-2.5-flash-image"

    async def _encode_reference(self, image_ref: str) -> str:
        if image_ref.startswith("data:image/"):
            return image_ref.split(",", 1)[-1]
        resp = await asyncio.to_thread(requests.get, image_ref, timeout=60)
        if resp.status_code != 200:
            raise Exception(f"Failed to download reference image: {resp.status_code}")
        return base64.b64encode(resp.content).decode('utf-8')

    async def generate_image(self, prompt: str, aspect_ratio: str = "16:9", reference_images: list = None) -> list:
        if not self.api_key:
            raise Exception("EMERGENT_LLM_KEY missing")

        chat = LlmChat(
            api_key=self.api_key,
            session_id=f"gemini-image-{uuid.uuid4().hex[:8]}",
            system_message="You are a helpful AI assistant"
        )
        chat.with_model("gemini", self.model_id).with_params(modalities=["image", "text"])

        prompt_text = f"{prompt}. Aspect ratio {aspect_ratio}. High quality children's illustration."
        file_contents = []
        if reference_images:
            for ref in reference_images[:2]:
                try:
                    img_b64 = await self._encode_reference(ref)
                    file_contents.append(ImageContent(img_b64))
                except Exception as e:
                    logger.warning(f"Gemini reference image skipped: {e}")

        msg = UserMessage(text=prompt_text, file_contents=file_contents if file_contents else None)
        text, images = await chat.send_message_multimodal_response(msg)
        if not images:
            raise Exception("Gemini image generation returned no images")
        return [("base64", img.get("data")) for img in images if img.get("data")]

    async def convert_image_style(self, image_url: str, style: str = "cartoon") -> dict:
        """
        Convert an image to different artistic styles using Gemini
        Styles: anime, toy, realistic, cartoon, watercolor, sketch
        """
        if not self.api_key:
            raise Exception("EMERGENT_LLM_KEY missing")

        # Define style prompts
        STYLE_PROMPTS = {
            "anime": "Convert this image into a Studio Ghibli anime style with vibrant colors and expressive features.",
            "toy": "Transform this into a 3D plastic toy figurine with smooth surfaces and bright colors.",
            "realistic": "Render this as a hyper-realistic 8k photograph with natural lighting and textures.",
            "cartoon": "Turn this into a colorful 3D Disney-style cartoon animation with exaggerated features.",
            "watercolor": "Convert this into a soft watercolor painting with gentle brush strokes and pastel colors.",
            "sketch": "Transform this into a professional pencil sketch with detailed shading and line work.",
            "comic": "Convert this into a comic book illustration with bold outlines and halftone shading.",
            "pixar": "Transform this into a Pixar-style 3D character with glossy textures and expressive eyes."
        }

        prompt = STYLE_PROMPTS.get(style, STYLE_PROMPTS["cartoon"])
        
        # Download the source image
        img_b64 = await self._encode_reference(image_url)
        
        # Use Gemini for style conversion
        chat = LlmChat(
            api_key=self.api_key,
            session_id=f"gemini-style-{uuid.uuid4().hex[:8]}",
            system_message="You are an expert image style conversion AI."
        )
        chat.with_model("gemini", self.style_model_id).with_params(modalities=["image", "text"])

        msg = UserMessage(
            text=prompt,
            file_contents=[ImageContent(img_b64)]
        )
        
        text, images = await chat.send_message_multimodal_response(msg)
        
        if not images or len(images) == 0:
            raise Exception("Gemini style conversion returned no images")
        
        # Return the converted image as base64
        converted_image = images[0].get("data")
        if not converted_image:
            raise Exception("No image data in Gemini response")
        
        return {
            "status": "completed",
            "style": style,
            "image_base64": converted_image,
            "format": "png"
        }


class FotorService:
    """Fotor API service for image cartoonization"""
    def __init__(self):
        self.api_key = os.environ.get('FOTOR_API_KEY')
        self.secret_key = os.environ.get('FOTOR_SECRET_KEY')
        self.base_url = os.environ.get('FOTOR_BASE_URL', 'https://developer-api.fotor.com')
    
    @property
    def headers(self):
        return {
            "api_key": self.api_key,
            "api_secret": self.secret_key,
            "Content-Type": "application/json"
        }
    
    async def get_templates(self) -> list:
        """Fetch available cartoon templates from Fotor"""
        try:
            response = await asyncio.to_thread(
                requests.get,
                f"{self.base_url}/api/v1/cartoonization/templates",
                headers=self.headers,
                timeout=30
            )
            data = response.json()
            # Mock response for dummy credentials
            if self.api_key.startswith('dummy'):
                return [
                    {"id": "cartoon_1", "name": "Classic Cartoon", "preview": ""},
                    {"id": "anime_1", "name": "Anime Style", "preview": ""},
                    {"id": "comic_1", "name": "Comic Book", "preview": ""},
                    {"id": "watercolor_1", "name": "Watercolor Art", "preview": ""}
                ]
            return data.get("templates", [])
        except Exception as e:
            logger.warning(f"Fotor templates fetch failed: {e}")
            # Return mock templates on error
            return [
                {"id": "cartoon_1", "name": "Classic Cartoon", "preview": ""},
                {"id": "anime_1", "name": "Anime Style", "preview": ""}
            ]
    
    async def generate_cartoonization(self, image_url: str, template_id: str = "cartoon_1") -> dict:
        """Start cartoonization job"""
        try:
            payload = {
                "image_url": image_url,
                "template_id": template_id,
                "strength": 0.8
            }
            response = await asyncio.to_thread(
                requests.post,
                f"{self.base_url}/api/v1/cartoonization/generate",
                headers=self.headers,
                json=payload,
                timeout=30
            )
            data = response.json()
            # Mock response for dummy credentials
            if self.api_key.startswith('dummy'):
                mock_task_id = f"mock_task_{uuid.uuid4().hex[:8]}"
                return {"task_id": mock_task_id, "status": "processing"}
            return data
        except Exception as e:
            logger.error(f"Fotor cartoonization failed: {e}")
            raise Exception(f"Cartoonization request failed: {str(e)}")
    
    async def get_task_status(self, task_id: str) -> dict:
        """Poll cartoonization task status"""
        try:
            response = await asyncio.to_thread(
                requests.get,
                f"{self.base_url}/api/v1/cartoonization/tasks/{task_id}",
                headers=self.headers,
                timeout=30
            )
            data = response.json()
            # Mock response for dummy credentials
            if self.api_key.startswith('dummy') or task_id.startswith('mock_task'):
                # Simulate completed job with a placeholder image
                return {
                    "task_id": task_id,
                    "status": "completed",
                    "result_url": "https://via.placeholder.com/512x512/6366F1/FFFFFF?text=Cartoonized"
                }
            return data
        except Exception as e:
            logger.error(f"Fotor task status failed: {e}")
            raise Exception(f"Task status check failed: {str(e)}")


class MiniMaxService:
    def __init__(self):
        self.api_key = os.environ.get('MINIMAX_API_KEY', '')
        # Remove 'Bearer ' prefix if present (we'll add it in headers)
        if self.api_key.startswith('Bearer '):
            self.api_key = self.api_key[7:]
        self.base_url = "https://api.minimax.io/v1"

    @property
    def headers(self):
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    async def generate_image(self, prompt: str, aspect_ratio: str = "16:9", reference_images: list = None) -> list:
        payload = {
            "model": "image-01",
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "response_format": "url",
            "n": 1
        }
        if reference_images:
            payload["images"] = reference_images[:3]
        response = await asyncio.to_thread(
            requests.post,
            f"{self.base_url}/image_generation",
            headers=self.headers,
            json=payload,
            timeout=120
        )
        data = response.json()
        status_code = data.get("base_resp", {}).get("status_code", -1)
        if status_code != 0:
            raise Exception(f"MiniMax image gen failed: {data.get('base_resp', {}).get('status_msg', 'unknown')}")
        urls = data.get("data", {}).get("image_urls", [])
        if not urls:
            b64_list = data.get("data", {}).get("image_base64", [])
            return [("base64", b) for b in b64_list]
        return [("url", u) for u in urls]

    async def generate_video(self, prompt: str, subject_references: list = None,
                            first_frame_image: str = None,
                            generation_type: str = "text-to-video") -> dict:
        """Generate video using MiniMax Hailuo.
        
        Args:
            prompt: Video description
            subject_references: List of character image URLs for consistency
            first_frame_image: Scene image URL for image-to-video mode
            generation_type: 'text-to-video' or 'image-to-video'
        """
        # Simplified payload - start with basics
        payload = {
            "model": "video-01",
            "prompt": prompt[:2000]
        }

        # Image-to-video: use scene image as first frame
        if generation_type == "image-to-video" and first_frame_image:
            payload["first_frame_image"] = first_frame_image
            logger.info("Using image-to-video mode with first_frame_image")

        # Note: subject_references might not be supported in current API version
        # Commenting out for now to fix "invalid params" error
        # if subject_references:
        #     payload["subject_reference"] = [{"image": url} for url in subject_references[:2]]
        #     logger.info(f"Using {len(subject_references[:2])} character subject references")

        logger.info(f"MiniMax video gen: creating task ({generation_type}) with payload keys: {list(payload.keys())}")
        response = await asyncio.to_thread(
            requests.post,
            f"{self.base_url}/video_generation",
            headers=self.headers,
            json=payload,
            timeout=60
        )
        data = response.json()
        
        # Better error logging
        if 'base_resp' in data and data['base_resp'].get('status_code') != 0:
            error_msg = data['base_resp'].get('status_msg', 'unknown')
            logger.error(f"MiniMax API error: {data}")
            raise Exception(f"MiniMax video API error: {error_msg}")
        
        task_id = data.get("task_id")
        if not task_id:
            raise Exception(f"MiniMax video: no task_id: {data}")

        logger.info(f"MiniMax video task: {task_id}")
        for attempt in range(120):
            await asyncio.sleep(5)
            status_resp = await asyncio.to_thread(
                requests.get,
                f"{self.base_url}/query/video_generation?task_id={task_id}",
                headers=self.headers,
                timeout=30
            )
            status_data = status_resp.json()
            status = status_data.get("status", "").lower()

            if status == "success":
                file_id = status_data.get("file_id")
                if file_id:
                    file_resp = await asyncio.to_thread(
                        requests.get,
                        f"{self.base_url}/files/retrieve?file_id={file_id}",
                        headers=self.headers,
                        timeout=30
                    )
                    file_data = file_resp.json()
                    download_url = file_data.get("file", {}).get("download_url", "")
                    return {"url": download_url, "file_id": file_id}
                return {"url": "", "file_id": ""}
            elif status in ["failed", "error"]:
                raise Exception(f"Video gen failed: {status_data}")

        raise Exception("Video generation timed out (10 min)")

    async def generate_tts(self, text: str, voice_id: str = "male-qn-qingse") -> bytes:
        payload = {
            "model": "speech-02-turbo",
            "text": text[:10000],
            "voice_setting": {
                "voice_id": voice_id,
                "speed": 1.0,
                "vol": 1.0,
                "pitch": 0
            },
            "audio_setting": {
                "format": "mp3",
                "sample_rate": 32000
            }
        }
        response = await asyncio.to_thread(
            requests.post,
            f"{self.base_url}/t2a_v2",
            headers=self.headers,
            json=payload,
            timeout=60
        )
        data = response.json()
        status_code = data.get("base_resp", {}).get("status_code", -1)
        if status_code != 0:
            raise Exception(f"MiniMax TTS failed: {data.get('base_resp', {}).get('status_msg', 'unknown')}")
        audio_hex = data.get("data", {}).get("audio", "")
        if not audio_hex:
            raise Exception("MiniMax TTS: empty audio response")
        return bytes.fromhex(audio_hex)

    async def generate_music(self, prompt: str) -> dict:
        payload = {
            "model": "music-01",
            "prompt": prompt[:2000],
        }
        logger.info(f"MiniMax music gen: {prompt[:80]}...")
        response = await asyncio.to_thread(
            requests.post,
            f"{self.base_url}/music_generation",
            headers=self.headers,
            json=payload,
            timeout=120
        )
        data = response.json()
        if not data or not isinstance(data, dict):
            raise Exception("MiniMax music: invalid response")

        # Check for errors
        base_resp = data.get("base_resp") or {}
        if base_resp.get("status_code") and base_resp.get("status_code") != 0:
            raise Exception(f"MiniMax music failed: {base_resp.get('status_msg', 'unknown error')}")

        # Direct audio response
        inner_data = data.get("data") or {}
        if isinstance(inner_data, dict) and inner_data.get("audio"):
            audio_hex = inner_data["audio"]
            return {"type": "bytes", "data": bytes.fromhex(audio_hex)}

        task_id = data.get("task_id")
        if task_id:
            logger.info(f"MiniMax music task: {task_id}")
            for _ in range(60):
                await asyncio.sleep(5)
                status_resp = await asyncio.to_thread(
                    requests.get,
                    f"{self.base_url}/query/music_generation?task_id={task_id}",
                    headers=self.headers,
                    timeout=30
                )
                status_data = status_resp.json() or {}
                status = (status_data.get("status") or "").lower()
                if status == "success":
                    file_id = status_data.get("file_id")
                    if file_id:
                        file_resp = await asyncio.to_thread(
                            requests.get,
                            f"{self.base_url}/files/retrieve?file_id={file_id}",
                            headers=self.headers,
                            timeout=30
                        )
                        file_json = file_resp.json() or {}
                        url = (file_json.get("file") or {}).get("download_url", "")
                        return {"type": "url", "data": url}
                    sd = status_data.get("data") or {}
                    if isinstance(sd, dict) and sd.get("audio"):
                        return {"type": "bytes", "data": bytes.fromhex(sd["audio"])}
                elif status in ["failed", "error"]:
                    raise Exception(f"Music gen failed: {status_data}")
            raise Exception("Music generation timed out")

        raise Exception(f"MiniMax music: unexpected response: {data}")
