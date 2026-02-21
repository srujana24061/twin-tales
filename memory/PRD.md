# StoryCraft AI - Product Requirements Document

## Original Problem Statement
StoryCraft AI — Responsible AI Kids Story PDF & Video Generator. A distributed AI orchestration platform for creating personalized children's stories with illustrated scenes, video generation, audio narration, background music, PDF export, and safety checks.

## Architecture
- **Frontend**: React 19 + TailwindCSS + Shadcn UI + Framer Motion
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **AI Text**: OpenAI GPT-5.2 via emergentintegrations (Emergent LLM Key)
- **AI Image**: MiniMax Image-01 API
- **AI Video**: MiniMax Hailuo (video-01) API
- **AI Audio/TTS**: MiniMax Speech (speech-02-turbo) API
- **AI Music**: MiniMax Music (music-01) API
- **Storage**: AWS S3 (storymaker-jcool bucket, ap-south-1)
- **Auth**: JWT-based with bcrypt hashing

## User Personas
- Parents (25-45), Teachers, Content Creators

## What's Been Implemented

### Phase 1 (Feb 2026)
- Landing page with glassmorphism + animations
- JWT auth (register/login)
- Character Builder CRUD
- Story setup with full config
- AI story generation (GPT-5.2)
- Scene editor with editing
- PDF generation (reportlab)
- Job tracking with progress
- Responsible AI safety checks
- Dashboard with stats

### Phase 2 (Feb 2026)
- MiniMax Image-01 integration (replaced GPT Image 1)
- MiniMax Hailuo video generation per scene
- MiniMax Speech TTS narration per scene (4 voice options)
- MiniMax Music background music generation
- AWS S3 media storage (replaced MongoDB base64)
- Media Studio panel in Scene Editor
- Video/audio players per scene
- Voice style selector for narration
- Progress tracking for all media types
- Updated Task History with new job types

## Prioritized Backlog
### P0 (Next)
- Video editor (timeline, drag-drop, clip management)
- Social media ad generator
- Final video export (FFmpeg compile all scenes + audio + music)

### P1
- Curated story templates
- WebSocket live progress
- Character face-mapping
- Multi-language TTS support

### P2
- Story sharing/publishing gallery
- Collaborative editing
- User profile & subscription management
