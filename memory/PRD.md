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
    │   │   ├── ParentDashboardPage.js
    │   │   ├── FriendsPage.js
    │   │   └── CollaborationPage.js
    │   └── components/
    │       ├── TwinneeChatWidget.js  # Floating chat widget
    │       └── ui/                    # Shadcn components
    └── .env
```

## What's Been Implemented

### December 2025
- [x] Complete TWINTEE → TWINNEE rename across entire codebase
- [x] New landing page design with gradient text and mascot
- [x] Fixed TwinneeChatWidget component naming
- [x] Fixed server.py syntax errors (missing except blocks)
- [x] Fixed TwinneeChat class name in twinnee.py
- [x] Chat widget functional with OpenAI integration
- [x] Dashboard working with TWINNEE branding

### Previous Implementation
- [x] TWINNEE AI Chatbot with OpenAI
- [x] Behavior scoring system
- [x] Parent Dashboard with scores display
- [x] Story creation and editing
- [x] Video editor with media library
- [x] Social collaboration backend (friends, sessions)

## API Endpoints

### Authentication
- POST `/api/auth/register` - User registration
- POST `/api/auth/login` - User login
- GET `/api/auth/me` - Get current user

### Chat
- POST `/api/chat/message` - Send message to TWINNEE
- GET `/api/chat/history` - Get conversation history

### Behavior
- GET `/api/behavior/scores` - Get user behavior scores
- POST `/api/behavior/activity` - Log activity
- GET `/api/twinnee/patterns` - Get learned patterns
- GET `/api/twinnee/risk-check` - Check behavioral risks

### Social
- POST `/api/friends/request` - Send friend request
- GET `/api/friends/requests` - Get pending requests
- POST `/api/friends/respond` - Accept/decline request
- GET `/api/friends/list` - Get friends list
- POST `/api/collab/create` - Create collaboration session
- POST `/api/collab/contribute` - Add contribution

## Database Collections
- users
- stories
- scenes
- characters
- conversations
- behavior_logs
- user_scores
- user_patterns
- friendships
- friend_requests
- collab_sessions
- collab_reports

## 3rd Party Integrations
- **OpenAI** - TWINNEE chatbot (GPT-4o-mini)
- **AWS S3** - Media storage
- **Gemini Nano Banana** - Image generation (Emergent LLM Key)
- **Amazon SES** - Email notifications

## Pending/Upcoming Tasks

### P1 - High Priority
- [ ] Complete Friends page UI (search, add, manage friends)
- [ ] Parent approval flow for friend requests
- [ ] Turn-based collaborative story writing UI

### P2 - Medium Priority
- [ ] TWINNEE AI mediator in collaboration
- [ ] Collaboration reports page
- [ ] Update auth page branding (still shows StoryCraft)

### P3 - Low Priority
- [ ] Notification system completion
- [ ] MiniMax video API fix
- [ ] Ad Studio page

## Known Issues
- S3 delete permission may be missing (IAM config)
- MiniMax API "invalid params" error (payload issue)

## Test Credentials
- Email: video_test_1771703962@test.com
- Password: TestPass123!
