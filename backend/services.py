import os
import boto3
import requests
import asyncio
import logging
import base64
from elevenlabs import ElevenLabs, VoiceSettings

logger = logging.getLogger(__name__)

# ElevenLabs voice map (voice_style → ElevenLabs voice_id)
ELEVENLABS_VOICES = {
    "child": "EXAVITQu4vr4xnSDxMaL",       # Bella - young female
    "female": "21m00Tcm4TlvDq8ikWAM",       # Rachel - warm female
    "male": "TxGEqnHWrfWFTfGW9XjX",         # Josh - deep male
    "storyteller": "pNInz6obpgDQGcFmaJgB",   # Adam - narrator
}


class ElevenLabsService:
    def __init__(self):
        self.api_key = os.environ.get('ELEVENLABS_API_KEY')
        self.client = ElevenLabs(api_key=self.api_key) if self.api_key else None

    async def generate_tts(self, text: str, voice_style: str = "storyteller") -> bytes:
        if not self.client:
            raise Exception("ElevenLabs API key not configured")

        voice_id = ELEVENLABS_VOICES.get(voice_style, ELEVENLABS_VOICES["storyteller"])

        def _generate():
            audio_generator = self.client.text_to_speech.convert(
                text=text[:5000],
                voice_id=voice_id,
                model_id="eleven_multilingual_v2",
                voice_settings=VoiceSettings(
                    stability=0.7,
                    similarity_boost=0.8,
                    style=0.3,
                    use_speaker_boost=True
                )
            )
            audio_data = b""
            for chunk in audio_generator:
                audio_data += chunk
            return audio_data

        audio_bytes = await asyncio.to_thread(_generate)
        if not audio_bytes:
            raise Exception("ElevenLabs: empty audio response")
        logger.info(f"ElevenLabs TTS generated: {len(audio_bytes)} bytes, voice={voice_style}")
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


class MiniMaxService:
    def __init__(self):
        self.api_key = os.environ.get('MINIMAX_API_KEY')
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
        payload = {
            "model": "video-01",
            "prompt": prompt[:2000],
        }

        # Image-to-video: use scene image as first frame for visual consistency
        if generation_type == "image-to-video" and first_frame_image:
            payload["first_frame_image"] = first_frame_image
            logger.info("Using image-to-video mode with first_frame_image")

        # Character subject references for consistency
        if subject_references:
            payload["subject_reference"] = [{"image": url} for url in subject_references[:2]]
            logger.info(f"Using {len(subject_references[:2])} character subject references")

        logger.info(f"MiniMax video gen: creating task ({generation_type})")
        response = await asyncio.to_thread(
            requests.post,
            f"{self.base_url}/video_generation",
            headers=self.headers,
            json=payload,
            timeout=60
        )
        data = response.json()
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
            raise Exception(f"MiniMax music: invalid response")

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
