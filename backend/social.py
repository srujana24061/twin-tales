"""
TWINNEE Social Collaboration System
Friend system, collaborative story creation, and interaction analysis
"""

from datetime import datetime, timezone
from typing import List, Dict, Optional
from uuid import uuid4


class FriendSystem:
    """Manage friend requests and friendships"""
    
    @staticmethod
    async def send_friend_request(db, from_user_id: str, to_user_id: str) -> Dict:
        """
        Send a friend request (requires parent approval)
        """
        # Check if already friends
        existing_friendship = await db.friendships.find_one({
            "$or": [
                {"user1_id": from_user_id, "user2_id": to_user_id},
                {"user1_id": to_user_id, "user2_id": from_user_id}
            ]
        })
        
        if existing_friendship:
            return {"status": "already_friends"}
        
        # Check if request already exists
        existing_request = await db.friend_requests.find_one({
            "from_user_id": from_user_id,
            "to_user_id": to_user_id,
            "status": "pending"
        })
        
        if existing_request:
            return {"status": "request_pending"}
        
        # Create friend request
        request_doc = {
            "id": str(uuid4()),
            "from_user_id": from_user_id,
            "to_user_id": to_user_id,
            "status": "pending",  # pending, accepted, declined
            "parent_approved": False,
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.friend_requests.insert_one(request_doc)
        
        # Create notification for receiving user's parent
        await db.notifications.insert_one({
            "id": str(uuid4()),
            "user_id": to_user_id,
            "type": "friend_request",
            "message": "New friend request waiting for parent approval",
            "data": {"request_id": request_doc["id"]},
            "timestamp": datetime.now(timezone.utc),
            "read": False
        })
        
        return {"status": "sent", "request_id": request_doc["id"]}
    
    @staticmethod
    async def respond_to_request(db, request_id: str, action: str) -> bool:
        """
        Parent approves or declines friend request
        action: 'accept' or 'decline'
        """
        request = await db.friend_requests.find_one({"id": request_id})
        
        if not request or request.get("status") != "pending":
            return False
        
        if action == "accept":
            # Update request status
            await db.friend_requests.update_one(
                {"id": request_id},
                {"$set": {
                    "status": "accepted",
                    "parent_approved": True,
                    "approved_at": datetime.now(timezone.utc)
                }}
            )
            
            # Create friendship
            friendship_doc = {
                "id": str(uuid4()),
                "user1_id": request["from_user_id"],
                "user2_id": request["to_user_id"],
                "created_at": datetime.now(timezone.utc),
                "collaboration_count": 0,
                "last_collaboration": None
            }
            await db.friendships.insert_one(friendship_doc)
            
            # Notify both users
            for user_id in [request["from_user_id"], request["to_user_id"]]:
                await db.notifications.insert_one({
                    "id": str(uuid4()),
                    "user_id": user_id,
                    "type": "friend_accepted",
                    "message": "You have a new friend! Start collaborating on stories together!",
                    "timestamp": datetime.now(timezone.utc),
                    "read": False
                })
            
            return True
        
        elif action == "decline":
            await db.friend_requests.update_one(
                {"id": request_id},
                {"$set": {
                    "status": "declined",
                    "declined_at": datetime.now(timezone.utc)
                }}
            )
            return True
        
        return False
    
    @staticmethod
    async def get_friends(db, user_id: str) -> List[Dict]:
        """Get list of user's friends"""
        friendships = await db.friendships.find({
            "$or": [{"user1_id": user_id}, {"user2_id": user_id}]
        }).to_list(100)
        
        friend_ids = []
        for f in friendships:
            friend_id = f["user2_id"] if f["user1_id"] == user_id else f["user1_id"]
            friend_ids.append(friend_id)
        
        # Get friend details
        friends = []
        for friend_id in friend_ids:
            user = await db.users.find_one({"id": friend_id}, {"_id": 0, "password": 0})
            if user:
                friends.append({
                    "id": user["id"],
                    "name": user.get("name", "Friend"),
                    "email": user.get("email"),
                    "avatar": user.get("avatar")
                })
        
        return friends
    
    @staticmethod
    async def search_users(db, query: str, current_user_id: str) -> List[Dict]:
        """Search for users by name or email"""
        users = await db.users.find({
            "$or": [
                {"name": {"$regex": query, "$options": "i"}},
                {"email": {"$regex": query, "$options": "i"}}
            ],
            "id": {"$ne": current_user_id}  # Exclude self
        }, {"_id": 0, "password": 0}).limit(20).to_list(20)
        
        return users


class CollaborativeSession:
    """Manage collaborative story creation sessions"""
    
    @staticmethod
    async def create_session(db, user1_id: str, user2_id: str, story_topic: str) -> Dict:
        """
        Create a new collaborative story session
        """
        session_doc = {
            "id": str(uuid4()),
            "participants": [user1_id, user2_id],
            "story": {
                "topic": story_topic,
                "content": [],  # List of contributions
                "characters": []
            },
            "current_turn": user1_id,  # Who's turn it is
            "turn_count": 0,
            "status": "active",  # active, completed, abandoned
            "started_at": datetime.now(timezone.utc),
            "last_activity": datetime.now(timezone.utc)
        }
        
        await db.collab_sessions.insert_one(session_doc)
        
        # Log session creation
        await InteractionLogger.log_action(
            db, session_doc["id"], "system", "session_created",
            {"topic": story_topic}
        )
        
        # TWINNEE introduces the collaboration
        twintee_intro = f"Hey friends! 🎉 Let's create an amazing story about '{story_topic}' together! I'll be here to help. Who wants to start?"
        
        await db.collab_sessions.update_one(
            {"id": session_doc["id"]},
            {"$push": {"story.content": {
                "contributor": "twintee",
                "text": twintee_intro,
                "timestamp": datetime.now(timezone.utc),
                "turn": 0
            }}}
        )
        
        return session_doc
    
    @staticmethod
    async def take_turn(db, session_id: str, user_id: str, contribution: str) -> Dict:
        """
        User contributes to the collaborative story
        """
        session = await db.collab_sessions.find_one({"id": session_id})
        
        if not session:
            return {"error": "Session not found"}
        
        if session["current_turn"] != user_id:
            return {"error": "Not your turn"}
        
        if session["status"] != "active":
            return {"error": "Session is not active"}
        
        # Add contribution
        turn_num = session["turn_count"] + 1
        contribution_doc = {
            "contributor": user_id,
            "text": contribution,
            "timestamp": datetime.now(timezone.utc),
            "turn": turn_num
        }
        
        # Update session
        other_user = [u for u in session["participants"] if u != user_id][0]
        
        await db.collab_sessions.update_one(
            {"id": session_id},
            {
                "$push": {"story.content": contribution_doc},
                "$set": {
                    "current_turn": other_user,
                    "turn_count": turn_num,
                    "last_activity": datetime.now(timezone.utc)
                }
            }
        )
        
        # Log contribution
        await InteractionLogger.log_action(
            db, session_id, user_id, "contribution",
            {"text": contribution, "turn": turn_num}
        )
        
        # TWINNEE mediator response (every 2-3 turns)
        if turn_num % 2 == 0 or turn_num % 3 == 0:
            twintee_response = await TwinteeMediator.provide_guidance(
                db, session, contribution
            )
            
            await db.collab_sessions.update_one(
                {"id": session_id},
                {"$push": {"story.content": {
                    "contributor": "twintee",
                    "text": twintee_response,
                    "timestamp": datetime.now(timezone.utc),
                    "turn": turn_num
                }}}
            )
        
        return {"success": True, "turn": turn_num}
    
    @staticmethod
    async def get_session(db, session_id: str) -> Optional[Dict]:
        """Get session details"""
        session = await db.collab_sessions.find_one({"id": session_id}, {"_id": 0})
        return session
    
    @staticmethod
    async def complete_session(db, session_id: str):
        """Mark session as completed"""
        await db.collab_sessions.update_one(
            {"id": session_id},
            {
                "$set": {
                    "status": "completed",
                    "completed_at": datetime.now(timezone.utc)
                }
            }
        )
        
        # Generate interaction reports for both participants
        await InteractionAnalyzer.generate_reports(db, session_id)


class InteractionLogger:
    """Log all interactions during collaboration"""
    
    @staticmethod
    async def log_action(db, session_id: str, user_id: str, action_type: str, data: Dict):
        """
        Log an action during collaboration
        
        action_types: session_created, contribution, character_added, edit, etc.
        """
        log_doc = {
            "id": str(uuid4()),
            "session_id": session_id,
            "user_id": user_id,
            "action_type": action_type,
            "data": data,
            "timestamp": datetime.now(timezone.utc)
        }
        
        await db.collab_logs.insert_one(log_doc)
    
    @staticmethod
    async def get_session_logs(db, session_id: str) -> List[Dict]:
        """Get all logs for a session"""
        logs = await db.collab_logs.find(
            {"session_id": session_id},
            {"_id": 0}
        ).sort("timestamp", 1).to_list(1000)
        
        return logs


class TwinteeMediator:
    """TWINNEE acts as gentle guide and active participant"""
    
    @staticmethod
    async def provide_guidance(db, session: Dict, latest_contribution: str) -> str:
        """
        Provide gentle guidance based on collaboration progress
        """
        from twintee import TwinteeChat
        
        turn_count = session["turn_count"]
        content = session["story"]["content"]
        
        # Analyze collaboration
        user_contributions = [c for c in content if c["contributor"] != "twintee"]
        
        # Build context for TWINTEE
        context = f"""You are mediating a collaborative story between two kids.
        
Story topic: {session['story']['topic']}
Current turn: {turn_count}
Latest contribution: {latest_contribution}

Your role as mediator:
- Be encouraging and supportive
- Suggest creative ideas to keep the story going
- Praise both kids' contributions
- Help if they seem stuck
- Keep it fun and engaging

Provide a brief, encouraging response (1-2 sentences) that:
1. Acknowledges the latest contribution
2. Suggests what could happen next OR asks an engaging question"""
        
        # Use OpenAI to generate response
        from openai import OpenAI
        import os
        
        client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))
        
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": context},
                    {"role": "user", "content": "Generate a mediator response"}
                ],
                max_tokens=100,
                temperature=0.9
            )
            
            return response.choices[0].message.content.strip()
        
        except Exception:
            # Fallback responses
            fallbacks = [
                "Wow! That's creative! 🎨 What happens next?",
                "Love it! Now, what does the other character do?",
                "This is getting exciting! Keep going! ⭐",
                "Great teamwork! What's the next part of the adventure?",
                "Nice! I wonder what they'll discover next? 🔍"
            ]
            import random
            return random.choice(fallbacks)


class InteractionAnalyzer:
    """Analyze collaboration and generate reports"""
    
    @staticmethod
    async def generate_reports(db, session_id: str):
        """
        Generate individual reports for each participant
        """
        session = await db.collab_sessions.find_one({"id": session_id})
        logs = await InteractionLogger.get_session_logs(db, session_id)
        
        if not session:
            return
        
        participants = session["participants"]
        
        for user_id in participants:
            report = await InteractionAnalyzer._analyze_user_contribution(
                db, session, logs, user_id
            )
            
            # Save report
            report_doc = {
                "id": str(uuid4()),
                "session_id": session_id,
                "user_id": user_id,
                "report": report,
                "created_at": datetime.now(timezone.utc)
            }
            
            await db.collab_reports.insert_one(report_doc)
            
            # Notify user and parent
            await db.notifications.insert_one({
                "id": str(uuid4()),
                "user_id": user_id,
                "type": "collaboration_report",
                "message": "Your collaboration report is ready!",
                "data": {"report_id": report_doc["id"]},
                "timestamp": datetime.now(timezone.utc),
                "read": False
            })
    
    @staticmethod
    async def _analyze_user_contribution(db, session: Dict, logs: List[Dict], user_id: str) -> Dict:
        """
        Analyze individual user's contribution and behavior
        """
        # Count contributions
        user_contributions = [
            c for c in session["story"]["content"] 
            if c.get("contributor") == user_id
        ]
        
        total_contributions = len([
            c for c in session["story"]["content"]
            if c.get("contributor") != "twintee"
        ])
        
        contribution_percentage = (len(user_contributions) / total_contributions * 100) if total_contributions > 0 else 0
        
        # Analyze traits
        traits = {
            "creativity": 0,
            "leadership": 0,
            "collaboration": 0,
            "engagement": 0
        }
        
        # Creativity: Unique words, descriptive language
        total_words = sum(len(c["text"].split()) for c in user_contributions)
        if total_words > 50:
            traits["creativity"] = min(100, (total_words / 5))
        
        # Leadership: Started first, more contributions
        if user_contributions and user_contributions[0]["turn"] <= 2:
            traits["leadership"] += 30
        if contribution_percentage > 55:
            traits["leadership"] += 20
        
        # Collaboration: Balanced participation
        if 40 <= contribution_percentage <= 60:
            traits["collaboration"] = 90
        elif 30 <= contribution_percentage <= 70:
            traits["collaboration"] = 70
        else:
            traits["collaboration"] = 50
        
        # Engagement: Consistent participation
        traits["engagement"] = min(100, len(user_contributions) * 20)
        
        # Get user info
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        
        report = {
            "user_name": user.get("name", "User"),
            "session_topic": session["story"]["topic"],
            "duration_minutes": (session.get("completed_at", datetime.now(timezone.utc)) - session["started_at"]).total_seconds() / 60,
            "total_contributions": len(user_contributions),
            "contribution_percentage": round(contribution_percentage, 1),
            "traits": traits,
            "highlights": [],
            "suggestions": []
        }
        
        # Add highlights
        if traits["creativity"] > 70:
            report["highlights"].append("🎨 Very creative storytelling!")
        if traits["leadership"] > 60:
            report["highlights"].append("⭐ Great leadership skills!")
        if traits["collaboration"] > 80:
            report["highlights"].append("🤝 Excellent team player!")
        if traits["engagement"] > 70:
            report["highlights"].append("💪 Highly engaged throughout!")
        
        # Add suggestions
        if traits["collaboration"] < 60:
            report["suggestions"].append("Try to balance contributions with your friend next time")
        if traits["creativity"] < 50:
            report["suggestions"].append("Add more descriptive details to your stories")
        if traits["engagement"] < 60:
            report["suggestions"].append("Stay engaged throughout the whole collaboration")
        
        return report
