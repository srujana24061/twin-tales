# Twinnee AI - PRD

## Architecture
Frontend: React 19 + TailwindCSS + Shadcn + Framer Motion | Backend: FastAPI + MongoDB + imageio-ffmpeg
AI: OpenAI GPT (text), **Gemini Nano Banana** (images + video frames) | Storage: AWS S3 | Auth: JWT | Email: Amazon SES

## Complete Feature Set
1. Landing page, JWT auth, Dashboard with stats + story suggestion cards (click → auto-populate form)
2. Character Builder with photo upload (S3)
3. Story Setup (tone, visual style, length, theme, characters, topic) — pre-fills from dashboard suggestion state
4. AI Story Generation → scenes with text/prompts
5. **Scene Grid Editor** — grid view, Image/Video toggle per card, generate/upload/regenerate per scene
6. **Image Generation** — Gemini Nano Banana (`gemini-3-pro-image-preview`) via Emergent LLM Key
7. **Video Generation** — Nano Banana generates 4 animated frames → imageio-ffmpeg stitches MP4 slideshow
8. Audio Narration (ElevenLabs TTS)
9. PDF Export (reportlab)
10. Batch Generate All Videos button with job polling
11. In-app notification bell + Amazon SES email on completion
12. Healthy Engagement: AI Wellbeing Check-in, Session Timer, PIN-protected Parent Dashboard
13. Parent Dashboard: analytics, session cap, parent email for notifications
14. Multi-theme UI switcher

## Video Generation Pipeline
- Nano Banana generates 4 frame variants (establishing, close-up, action, resolution)
- Existing scene image used as frame 0 if available
- imageio-ffmpeg stitches frames into MP4 at 1fps, 4s per frame
- Uploaded to S3, video_url stored on scene document
- Job polling in SceneGridEditor frontend (3s interval)

## Scene Grid Editor
- Grid layout, per-card Image/Video toggle pill
- Image tab: generated/uploaded image, generate/regen/upload buttons
- Video tab: video player (if ready), generate/upload buttons, spinner when generating
- Auto-switches to Video tab when video becomes available
- data-testid on all interactive elements

## Pending / Roadmap
- P1: S3 presigned URL direct uploads (currently proxied)
- P2: Phone number field in registration UI (backend schema has it)
- P2: FFmpeg full-story video export
- P2: Video Editor page (reorder scenes)
- P3: Ad Studio page
- P3: UX Polish (micro-animations)
