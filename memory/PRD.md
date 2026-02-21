# StoryCraft AI - Product Requirements Document

## Architecture
- Frontend: React 19 + TailwindCSS + Shadcn UI + Framer Motion
- Backend: FastAPI + MongoDB (Motor)
- AI Text: OpenAI GPT-5.2 via emergentintegrations
- AI Image: MiniMax Image-01 (with character reference images support)
- AI Video: MiniMax Hailuo (with subject_reference for character consistency)
- AI Audio/TTS: MiniMax Speech-02-turbo
- AI Music: MiniMax Music-01
- Storage: MongoDB base64 fallback (S3 IAM permission issue with provided credentials)
- Auth: JWT + bcrypt

## What's Been Implemented
### Phase 1 - Core Story Pipeline
- Landing page, JWT auth, Character CRUD, Story setup, AI story gen (GPT-5.2), Scene editor, PDF gen, Job tracking, Responsible AI safety checks, Dashboard

### Phase 2 - Full Media Pipeline
- MiniMax Image-01, Video (Hailuo), TTS (Speech), Music integration
- AWS S3 integration (with MongoDB fallback)
- Media Studio panel, video/audio players, voice selector

### Phase 3 - Character Photo References
- Character photo upload (JPEG/PNG/WEBP, max 10MB)
- Photos stored in MongoDB with media asset entries
- Served via public /api/media/{id} endpoint
- Reference images passed to MiniMax Image-01 (images param) for visual consistency
- Reference images passed to MiniMax Hailuo (subject_reference) for video consistency
- Camera icon overlay on character cards for quick photo upload
- Photo preview in character creation/edit modal

## Note: S3 Permission Issue
The provided AWS IAM credentials (ses-notification-user) lack s3:PutObject permission. System falls back to MongoDB base64 storage. To fix: grant S3 full access to the IAM user or provide new credentials with proper S3 permissions.

## Prioritized Backlog
### P0: Video editor, Social media ad generator, FFmpeg final export
### P1: Curated templates, WebSocket progress, Character face-mapping
### P2: Story sharing gallery, Multi-language TTS, User profiles
