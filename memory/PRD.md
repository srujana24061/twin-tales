# TWINNEE - AI Digital Twin Companion for Children

## Product Overview
TWINNEE is an AI-powered "digital twin" companion for children, designed to promote healthy habits, creativity, and emotional balance through conversational interaction.

## Branding
- **Logo**: Dolphin mascot image (`/twinnee-logo.png` in public folder)
- Used in: Navbar (top left), LandingPage header + hero section, Dashboard greeting

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
- **Doodle-to-Image** - Draw sketches that AI converts to polished 3D illustrations

### 4. Social Collaboration (NEW - COMPLETE!)
- **Friend System**: Search users, send/receive friend requests, accept/decline
- **Collaborative Story Chat**: Real-time chat space with friends
- **Turn-Based Story Writing**: Each user takes turns contributing to the story
- **TWINNEE AI Mediator**: Introduces collaborations and guides the story
- **Chat + Story Views**: Toggle between chat messages and story content

## Technical Architecture

```
/app
├── backend/
│   ├── server.py          # Main FastAPI app (routes at end)
│   ├── twinnee.py         # AI chatbot, scoring logic
│   ├── social.py          # Friends & collaboration
│   └── .env               # Environment variables
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── LandingPage.js
    │   │   ├── DashboardPage.js
    │   │   ├── FriendsPage.js      # Friend management
    │   │   ├── CollabChatPage.js   # NEW: Collaborative chat space
    │   │   └── SceneGridEditor.js
    │   └── components/
    │       ├── TwinneeChatWidget.js
    │       ├── DoodleCanvasModal.js
    │       └── ui/
    └── .env
```

## What's Been Implemented

### December 2025 (Latest Session)
- [x] Complete TWINTEE → TWINNEE rename
- [x] New landing page with gradient text and mascot
- [x] Doodle-to-Image feature for scenes (3D colored smooth conversion)
- [x] **Friend Request System**
  - Search users by name/email
  - Send friend requests
  - View incoming/outgoing requests
  - Accept/decline requests
  - Friends list with "Create Story Together" button
- [x] **Collaborative Story Chat Page**
  - Real-time chat between friends
  - Turn-based story contributions
  - Chat view and Story view toggle
  - Turn indicator (your turn / waiting)
  - TWINNEE intro message
  - Chat messages vs story contributions differentiation

## API Endpoints

### Friends
- GET `/api/friends/list` - Get friends list
- GET `/api/friends/requests` - Get pending requests (incoming/outgoing)
- GET `/api/friends/search?query=` - Search users
- POST `/api/friends/request` - Send friend request
- POST `/api/friends/respond` - Accept/decline request

### Collaboration
- POST `/api/collab/create` - Start collaboration session
- GET `/api/collab/session/{id}` - Get session details
- GET `/api/collab/my-sessions` - Get user's active sessions
- POST `/api/collab/chat` - Send chat message
- GET `/api/collab/chat/{id}` - Get chat messages

### Doodle-to-Image
- POST `/api/scenes/{scene_id}/doodle-to-image` - Convert doodle to 3D image

## 3rd Party Integrations
- **OpenAI** - TWINNEE chatbot (GPT-4o-mini)
- **Gemini Nano Banana** - Image generation (Emergent LLM Key)
- **AWS S3** - Media storage

## Test Credentials
- User 1: video_test_1771703962@test.com / TestPass123!
- User 2: friend_test@test.com / TestPass123!

## Pending Tasks

### P2 - Medium Priority
- [ ] Update auth page branding (still shows StoryCraft)
- [ ] Parent approval workflow for friend requests (for child safety)
- [ ] Collaboration reports for parents

### P3 - Low Priority
- [ ] Notification system completion
- [ ] MiniMax video API fix
