# StoryCraft AI - PRD

## Architecture
Frontend: React 19 + TailwindCSS + Shadcn + Framer Motion | Backend: FastAPI + MongoDB + FFmpeg
AI: GPT-5.2 (text), MiniMax Image-01/Hailuo/Speech/Music | Storage: AWS S3 | Auth: JWT

## Complete Feature Set
1. Landing page, JWT auth, Dashboard with stats
2. Character Builder with photo upload (S3) + reference images
3. Story Setup (tone, visual style, length, theme, characters, topic/full story)
4. AI Story Generation (GPT-5.2 → scenes with text/prompts)
5. Scene Editor (edit text, prompts, regenerate images)
6. Image Generation (MiniMax Image-01 + character reference images)
7. Video Generation (MiniMax Hailuo) — **image-to-video mode** using scene images as first_frame + character subject_reference
8. Audio Narration (MiniMax Speech TTS, 4 voices)
9. Background Music (MiniMax Music-01)
10. PDF Export (reportlab)
11. Video Editor (timeline, reorder, duration, export)
12. FFmpeg Video Export (compile scenes + narration + music → MP4)
13. Social Media Ad Generator (5 platforms, AI hook/caption/hashtags)
14. Responsible AI safety checks
15. Job/Task tracking with progress

## Video Generation Pipeline (Updated)
- Auto-detects if scene has image → uses **image-to-video** mode with first_frame_image
- Falls back to **text-to-video** if no scene image exists
- Character photos passed as **subject_reference** for visual consistency
- Rich prompts include character names, traits, descriptions
- Pattern extracted from user's uploaded reference codebase (src.zip)

## Note: MiniMax TTS may show "insufficient balance" — user needs to top up MiniMax account

## Implementation Log
- 2026-02-21: Added Celery task wiring (preview runs in eager mode), Video Editor scene settings (duration, trim, transitions, include), and FFmpeg export updates (5s default, trims, optional fade transition).

## Prioritized Backlog
P0
- Ad Generator video rendering (vertical promos for Reels/Shorts/TikTok/Facebook/YouTube).
- Production Celery worker + broker configuration.

P1
- Notifications for completed jobs.

P2
- Dialogue-based video with lip-sync.
- Expanded Responsible AI checks.
