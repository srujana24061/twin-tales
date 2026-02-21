"""
One-time migration script: replace all /api/media/ proxied URLs with direct S3 URLs
in scenes, characters, stories, and generation_jobs collections.
"""
import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']


async def main():
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    stats = {"scenes": 0, "characters": 0, "stories": 0, "jobs": 0, "not_found": 0}

    async def resolve(media_url):
        """Return direct S3 URL for a /api/media/ URL, or the original if already direct."""
        if not media_url or not media_url.startswith("/api/media/"):
            return media_url
        asset_id = media_url.split("/")[-1]
        asset = await db.media_assets.find_one({"id": asset_id}, {"_id": 0, "s3_url": 1})
        if asset and asset.get("s3_url"):
            return asset["s3_url"]
        stats["not_found"] += 1
        return media_url  # keep as-is if no S3 URL found

    # 1. Scenes
    print("Migrating scenes...")
    async for scene in db.scenes.find({}, {"_id": 0, "id": 1, "image_url": 1, "video_url": 1, "audio_url": 1}):
        updates = {}
        for field in ("image_url", "video_url", "audio_url"):
            val = scene.get(field, "")
            if val and val.startswith("/api/media/"):
                new_val = await resolve(val)
                if new_val != val:
                    updates[field] = new_val
        if updates:
            await db.scenes.update_one({"id": scene["id"]}, {"$set": updates})
            stats["scenes"] += 1

    # 2. Characters
    print("Migrating characters...")
    async for char in db.characters.find({}, {"_id": 0, "id": 1, "reference_image": 1, "styled_photo_url": 1}):
        updates = {}
        for field in ("reference_image", "styled_photo_url"):
            val = char.get(field, "")
            if val and val.startswith("/api/media/"):
                new_val = await resolve(val)
                if new_val != val:
                    updates[field] = new_val
        if updates:
            await db.characters.update_one({"id": char["id"]}, {"$set": updates})
            stats["characters"] += 1

    # 3. Stories (music_url stored in doc)
    print("Migrating stories...")
    async for story in db.stories.find({}, {"_id": 0, "id": 1, "music_url": 1}):
        val = story.get("music_url", "")
        if val and val.startswith("/api/media/"):
            new_val = await resolve(val)
            if new_val != val:
                await db.stories.update_one({"id": story["id"]}, {"$set": {"music_url": new_val}})
                stats["stories"] += 1

    # 4. Generation jobs
    print("Migrating generation jobs...")
    async for job in db.generation_jobs.find({}, {"_id": 0, "id": 1, "result_url": 1}):
        val = job.get("result_url", "")
        if val and val.startswith("/api/media/"):
            new_val = await resolve(val)
            if new_val != val:
                await db.generation_jobs.update_one({"id": job["id"]}, {"$set": {"result_url": new_val}})
                stats["jobs"] += 1

    client.close()
    print("\nMigration complete!")
    print(f"  Scenes updated:    {stats['scenes']}")
    print(f"  Characters updated:{stats['characters']}")
    print(f"  Stories updated:   {stats['stories']}")
    print(f"  Jobs updated:      {stats['jobs']}")
    print(f"  Assets not found:  {stats['not_found']}")


if __name__ == "__main__":
    asyncio.run(main())
