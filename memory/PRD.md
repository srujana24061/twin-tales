# StoryCraft AI - Product Requirements Document

## Architecture
- Frontend: React 19 + TailwindCSS + Shadcn UI + Framer Motion
- Backend: FastAPI + MongoDB (Motor) + FFmpeg
- AI Text: OpenAI GPT-5.2 via emergentintegrations
- AI Image: MiniMax Image-01 (with character reference)
- AI Video: MiniMax Hailuo (with subject_reference)
- AI Audio/TTS: MiniMax Speech-02-turbo (4 voices)
- AI Music: MiniMax Music-01
- Storage: AWS S3 + MongoDB fallback
- Auth: JWT + bcrypt
- Video: FFmpeg for final export compilation

## Complete Feature Set (All Phases)
### Phase 1: Core Story Pipeline
- Landing page (glassmorphism), JWT auth, Character CRUD, Story setup, AI scene gen (GPT-5.2), Scene editor, PDF gen, Job tracking, Responsible AI safety

### Phase 2: Full Media Pipeline
- MiniMax Image/Video/TTS/Music integration, AWS S3 storage, Media Studio panel, video/audio players, voice selector

### Phase 3: Character Photo References
- Photo upload to S3, reference images passed to MiniMax for visual consistency in image/video gen

### Phase 4: Video Editor + Ad Generator + FFmpeg Export
- Video Editor with timeline UI, scene reorder, duration control
- FFmpeg export: compiles scenes + narration + background music → final MP4
- Social Media Ad Generator: AI creates hook/caption/hashtags for 5 platforms
- Scene reorder API, Ad project management

## Pages: Landing, Auth, Dashboard, Characters, Story Setup, Story Generation, Scene Editor, Video Editor, Ad Studio, Task History

## Backlog
### P0: Curated story templates, WebSocket live progress
### P1: Character face-mapping, multi-language TTS, story sharing gallery
### P2: Collaborative editing, subscription management
