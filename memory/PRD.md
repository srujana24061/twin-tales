# StoryCraft AI - Product Requirements Document

## Original Problem Statement
StoryCraft AI — Responsible AI Kids Story PDF & Video Generator. A distributed AI orchestration platform for creating personalized children's stories with illustrated scenes, PDF export, and safety checks.

## Architecture
- **Frontend**: React 19 + TailwindCSS + Shadcn UI + Framer Motion
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **AI**: OpenAI GPT-5.2 (text) + GPT Image 1 (illustrations) via emergentintegrations
- **Auth**: JWT-based with bcrypt hashing
- **Async**: asyncio.create_task for background generation jobs

## User Personas
- **Parents** (25-45): Create personalized bedtime stories featuring their children
- **Teachers**: Generate educational stories with specific moral themes
- **Content Creators**: Build illustrated story content at scale

## Core Requirements (Static)
1. Character Builder with traits, roles, speaking styles
2. Story Setup with tone, visual style, length, moral theme selection
3. AI Story Generation (topic-based or full-story parsing into scenes)
4. Scene-level image generation with GPT Image 1
5. Responsible AI safety checks on all generated content
6. PDF export with illustrated pages
7. Job/task tracking with progress polling
8. Editable scene editor with image regeneration

## What's Been Implemented (Feb 2026)
- [x] Landing page with glassmorphism design and animations
- [x] JWT auth system (register, login, token validation)
- [x] Character CRUD with traits, roles, speaking styles
- [x] Story creation with full configuration options
- [x] AI story generation engine (GPT-5.2 scene structuring)
- [x] AI image generation per scene (GPT Image 1)
- [x] Responsible AI safety checks per scene
- [x] Scene editor with text editing and image regeneration
- [x] PDF generation with reportlab
- [x] Job/task tracking with progress polling
- [x] Dashboard with stats overview
- [x] Task history page
- [x] Protected routes with auth guard
- [x] Responsive design with animations

## Prioritized Backlog
### P0 (Critical - Next Phase)
- Video generation pipeline (narrated + dialogue modes)
- Audio narration with ElevenLabs TTS
- WebSocket live progress tracking

### P1 (Important)
- Video editor (timeline, drag-drop, clip management)
- Social media ad generator
- Curated story templates
- Character face-mapping

### P2 (Nice to Have)
- Multi-language support
- Collaborative editing
- Story sharing/publishing
- Background music integration

## Next Tasks
1. Add WebSocket-based real-time progress updates
2. Implement video generation pipeline
3. Add curated story templates
4. Social media promotional video creator
5. User profile settings page
