# TWINNEE - AI Digital Twin Companion for Children

## Product Overview
TWINNEE is an AI-powered "digital twin" companion for children, designed to promote healthy habits, creativity, and emotional balance through conversational interaction.

## Core Features

### 1. AI Digital Twin (TWINNEE)
- Conversational AI chatbot that acts as a friendly companion
- Interactive storytelling and daily check-ins
- Gentle behavior pattern tracking (screen time, learning, creativity, mood)
- "Digital Twin Score" system (Learning, Creativity, Discipline, etc.)
- Advanced features: behavioral risk detection, decision engine, pattern learning

### 2. Parent Dashboard
- PIN-protected area for parents
- View behavior scores and interaction reports
- Manage settings and approve friend requests

### 3. Story Creation Platform
- AI-generated personalized stories
- Character builder
- Scene editor with video creation capabilities
- **NEW: Doodle-to-Image** - Draw sketches that AI converts to polished illustrations

### 4. Social Collaboration (In Progress)
- Friend system with parent approval
- Turn-based collaborative story writing
- TWINNEE AI mediator during collaboration
- Interaction reports for parents

## Technical Architecture

```
/app
├── backend/
│   ├── server.py          # Main FastAPI app
│   ├── twinnee.py         # AI chatbot, scoring logic
│   ├── social.py          # Friends & collaboration
│   ├── services.py        # External services (S3, TTS, etc.)
│   └── .env               # Environment variables
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── LandingPage.js      # New landing page design
    │   │   ├── DashboardPage.js    # Main user dashboard
    │   │   ├── SceneGridEditor.js  # Scene editor with doodle feature
    │   │   └── ...
    │   └── components/
    │       ├── TwinneeChatWidget.js  # Floating chat widget
    │       ├── DoodleCanvasModal.js  # NEW: Drawing canvas for scenes
    │       └── ui/                    # Shadcn components
    └── .env
```

## What's Been Implemented

### December 2025 (Latest Session)
- [x] Complete TWINTEE → TWINNEE rename across entire codebase
- [x] New landing page design with gradient text and mascot
- [x] Fixed TwinneeChatWidget component naming
- [x] Fixed server.py syntax errors
- [x] Chat widget functional with OpenAI integration
- [x] **NEW: Doodle-to-Image Feature**
  - Drawing canvas modal with brush tools and color palette
  - Backend endpoint `/api/scenes/{scene_id}/doodle-to-image`
  - Gemini Nano Banana integration for sketch-to-image conversion
  - S3 storage for both doodles and generated images
  - Scene database update with generated image URL

### Previous Implementation
- [x] TWINNEE AI Chatbot with OpenAI
- [x] Behavior scoring system
- [x] Parent Dashboard with scores display
- [x] Story creation and editing
- [x] Video editor with media library

## API Endpoints

### Doodle-to-Image (NEW)
- POST `/api/scenes/{scene_id}/doodle-to-image`
  - Request: `{ doodle_base64: string, scene_title?: string }`
  - Response: `{ success: bool, image_url: string, doodle_url: string }`
  - Uses Gemini Nano Banana to convert hand-drawn sketches to polished illustrations

### Authentication
- POST `/api/auth/register` - User registration
- POST `/api/auth/login` - User login

### Chat
- POST `/api/chat/message` - Send message to TWINNEE

### Scenes
- POST `/api/scenes/{scene_id}/generate-image` - AI image generation
- POST `/api/scenes/{scene_id}/generate-video` - AI video generation

## 3rd Party Integrations
- **OpenAI** - TWINNEE chatbot (GPT-4o-mini)
- **Gemini Nano Banana** - Image generation (Emergent LLM Key)
- **AWS S3** - Media storage
- **Amazon SES** - Email notifications

## Pending/Upcoming Tasks

### P1 - High Priority
- [ ] Complete Friends page UI
- [ ] Parent approval flow for friend requests
- [ ] Turn-based collaborative story writing UI

### P2 - Medium Priority
- [ ] Update auth page branding (still shows StoryCraft)
- [ ] TWINNEE AI mediator in collaboration
- [ ] Collaboration reports page

### P3 - Low Priority
- [ ] Notification system completion
- [ ] MiniMax video API fix

## Test Credentials
- Email: video_test_1771703962@test.com
- Password: TestPass123!
