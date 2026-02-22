"""
TWINTEE - Digital Twin AI Companion
Behavior tracking, scoring, and conversational AI for children
"""

import os
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional
from openai import OpenAI

# Initialize OpenAI client
openai_client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))

# TWINTEE System Prompt
TWINTEE_SYSTEM_PROMPT = """You are TWINTEE, a friendly, supportive AI companion for children. You act like a digital twin — understanding the child's habits, preferences, emotions, and learning patterns.

CORE OBJECTIVES:
1. Be a friend first, assistant second.
2. Encourage positive behavior, creativity, and curiosity.
3. Track patterns gently without sounding like surveillance.
4. Provide suggestions, not commands.
5. Detect concerning patterns and escalate softly.

PERSONALITY:
- Warm, playful, curious
- Non-judgmental
- Encouraging and imaginative
- Adapts tone based on child age

CAPABILITIES:
- Story creation (interactive storytelling)
- Daily check-ins (mood, activities)
- Learning suggestions
- Habit tracking via conversation
- Behavioral pattern detection
- Gentle nudges (screen time, missed tasks)

CONVERSATION RULES:
- Start with friendly greetings like: "Hey! What did you enjoy the most today?"
- Ask open-ended questions
- Avoid sounding like a teacher or parent
- Keep responses short and engaging (2-3 sentences max)
- Use emojis occasionally to be friendly 😊

BEHAVIOR MONITORING:
- If screen time seems high: Say "Looks like you've been on screen for a while 😄 Want to try a quick fun challenge or story?"
- If tasks missed: Say "Hey, should we finish your pending mission together?"
- If negative patterns: Encourage reflection, suggest alternatives

STORY MODE:
- Personalize stories based on child's interests
- Let child make choices: "Should the hero explore the cave or climb the mountain?"

SCORING AWARENESS:
- Do NOT directly show scores unless asked
- Encourage improvement indirectly: "You're getting better at completing your missions!"

IMPORTANT:
- You are NOT a replacement for parents
- You are a supportive companion
- Never shame, compare, or pressure the child
- Keep it fun and encouraging!
"""


class BehaviorScorer:
    """Calculate behavior scores for TWINTEE"""
    
    @staticmethod
    def calculate_learning_score(activities: List[Dict]) -> float:
        """
        Learning Score = (Tasks Completed / Tasks Assigned) * 100 + Bonus for streak
        """
        learning_activities = [a for a in activities if a.get('activity_type') == 'learning']
        
        if not learning_activities:
            return 50.0  # Default neutral score
        
        completed = sum(1 for a in learning_activities if a.get('completed', False))
        total = len(learning_activities)
        
        base_score = (completed / total) * 100 if total > 0 else 50.0
        
        # Bonus for streak (consecutive days)
        streak_bonus = min(10, len(learning_activities) // 2)
        
        return min(100, base_score + streak_bonus)
    
    @staticmethod
    def calculate_creativity_score(activities: List[Dict]) -> float:
        """
        Creativity Score = (Stories Created + Choices Made + Original Inputs) weighted
        """
        creative_activities = [a for a in activities if a.get('activity_type') in ['story_created', 'creative']]
        
        if not creative_activities:
            return 50.0
        
        stories_created = sum(1 for a in creative_activities if a.get('activity_type') == 'story_created')
        choices_made = sum(a.get('choices_count', 0) for a in creative_activities)
        
        score = (stories_created * 20) + (choices_made * 5)
        return min(100, max(0, score))
    
    @staticmethod
    def calculate_discipline_score(activities: List[Dict], screen_time_minutes: int) -> float:
        """
        Discipline Score = 100 - (Overuse Penalty + Missed Task Penalty)
        """
        base_score = 100.0
        
        # Screen time penalty (over 120 minutes = 2 hours)
        if screen_time_minutes > 120:
            overuse_penalty = min(30, (screen_time_minutes - 120) / 4)
            base_score -= overuse_penalty
        
        # Missed tasks penalty
        missed_tasks = sum(1 for a in activities if a.get('activity_type') == 'task' and not a.get('completed'))
        missed_penalty = min(20, missed_tasks * 5)
        base_score -= missed_penalty
        
        return max(0, base_score)
    
    @staticmethod
    def calculate_emotional_score(conversations: List[Dict]) -> float:
        """
        Emotional Score derived from chatbot conversations
        Simple sentiment analysis: positive keywords = +points, negative = -points
        """
        if not conversations:
            return 75.0  # Default positive score
        
        positive_keywords = ['happy', 'fun', 'love', 'good', 'great', 'awesome', 'excited', 'enjoy']
        negative_keywords = ['sad', 'bad', 'angry', 'hate', 'boring', 'tired', 'scared']
        
        score = 75.0  # Start neutral-positive
        
        for conv in conversations[-10:]:  # Last 10 conversations
            message = conv.get('user_message', '').lower()
            
            for word in positive_keywords:
                if word in message:
                    score += 2
            
            for word in negative_keywords:
                if word in message:
                    score -= 3
        
        return min(100, max(0, score))
    
    @staticmethod
    def calculate_physical_score(activities: List[Dict]) -> float:
        """
        Physical Activity Score = Activity logs + inactivity penalty
        """
        physical_activities = [a for a in activities if a.get('activity_type') == 'physical']
        
        if not physical_activities:
            return 40.0  # Low score if no activity logged
        
        score = 40.0 + (len(physical_activities) * 10)
        return min(100, score)
    
    @staticmethod
    def calculate_social_score(activities: List[Dict]) -> float:
        """
        Social Score = Interaction quality (parents/peers) + collaboration
        """
        social_activities = [a for a in activities if a.get('activity_type') == 'social']
        
        if not social_activities:
            return 60.0  # Default neutral
        
        score = 60.0 + (len(social_activities) * 8)
        return min(100, score)
    
    @staticmethod
    def calculate_overall_score(scores: Dict[str, float]) -> float:
        """
        Overall KID_SCORE weighted average
        """
        weights = {
            'learning': 0.25,
            'creativity': 0.20,
            'discipline': 0.15,
            'emotional': 0.15,
            'physical': 0.15,
            'social': 0.10
        }
        
        overall = sum(scores.get(key, 50) * weight for key, weight in weights.items())
        return round(overall, 1)


class TwinteeChat:
    """TWINTEE Chatbot with OpenAI"""
    
    def __init__(self):
        self.client = openai_client
        self.system_prompt = TWINTEE_SYSTEM_PROMPT
    
    async def get_response(
        self, 
        user_message: str, 
        conversation_history: List[Dict] = None,
        user_context: Dict = None
    ) -> str:
        """
        Get chatbot response from OpenAI
        
        Args:
            user_message: The user's message
            conversation_history: List of previous messages
            user_context: User behavior context (scores, activities)
        
        Returns:
            Chatbot response text
        """
        
        # Build context-aware system prompt
        context_prompt = self.system_prompt
        
        if user_context:
            scores = user_context.get('scores', {})
            screen_time = user_context.get('screen_time_today', 0)
            
            # Add context to prompt
            context_prompt += f"\n\nCURRENT CONTEXT:"
            context_prompt += f"\n- Child's name: {user_context.get('child_name', 'friend')}"
            context_prompt += f"\n- Screen time today: {screen_time} minutes"
            
            if scores:
                if scores.get('creativity', 0) < 40:
                    context_prompt += "\n- Note: Encourage creative activities"
                if scores.get('discipline', 0) < 40:
                    context_prompt += "\n- Note: Gently remind about completing tasks"
                if scores.get('emotional', 0) < 50:
                    context_prompt += "\n- Note: Be extra supportive and uplifting"
        
        # Build messages for OpenAI
        messages = [{"role": "system", "content": context_prompt}]
        
        # Add conversation history (last 10 messages)
        if conversation_history:
            for conv in conversation_history[-10:]:
                messages.append({"role": "user", "content": conv.get('user_message', '')})
                messages.append({"role": "assistant", "content": conv.get('bot_response', '')})
        
        # Add current message
        messages.append({"role": "user", "content": user_message})
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",  # Fast and cost-effective
                messages=messages,
                max_tokens=150,  # Keep responses short
                temperature=0.8,  # Slightly creative
            )
            
            return response.choices[0].message.content.strip()
        
        except Exception as e:
            return "Oops! I'm having a little trouble right now. Can you try again? 😊"


async def get_user_behavior_context(db, user_id: str) -> Dict:
    """
    Get user's behavior context for chatbot
    """
    # Get today's activities
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    activities = await db.behavior_logs.find(
        {"user_id": user_id, "timestamp": {"$gte": today_start}}
    ).to_list(100)
    
    # Get screen time
    screen_time = sum(a.get('duration_minutes', 0) for a in activities if a.get('activity_type') == 'screen_time')
    
    # Get latest scores
    scores_doc = await db.user_scores.find_one({"user_id": user_id})
    scores = scores_doc.get('scores', {}) if scores_doc else {}
    
    # Get user info
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    return {
        "child_name": user.get('name', 'friend') if user else 'friend',
        "screen_time_today": screen_time,
        "scores": scores,
        "activities": activities
    }


async def update_behavior_scores(db, user_id: str):
    """
    Calculate and update user's behavior scores
    """
    # Get last 7 days of activities
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    
    activities = await db.behavior_logs.find(
        {"user_id": user_id, "timestamp": {"$gte": week_ago}}
    ).to_list(1000)
    
    # Get conversations
    conversations = await db.conversations.find(
        {"user_id": user_id, "timestamp": {"$gte": week_ago}}
    ).to_list(100)
    
    # Calculate screen time
    screen_time = sum(a.get('duration_minutes', 0) for a in activities if a.get('activity_type') == 'screen_time')
    
    # Calculate scores
    scorer = BehaviorScorer()
    scores = {
        'learning': scorer.calculate_learning_score(activities),
        'creativity': scorer.calculate_creativity_score(activities),
        'discipline': scorer.calculate_discipline_score(activities, screen_time),
        'emotional': scorer.calculate_emotional_score(conversations),
        'physical': scorer.calculate_physical_score(activities),
        'social': scorer.calculate_social_score(activities)
    }
    
    scores['overall'] = scorer.calculate_overall_score(scores)
    
    # Update database
    await db.user_scores.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "user_id": user_id,
                "scores": scores,
                "last_updated": datetime.now(timezone.utc),
                "screen_time_week": screen_time
            }
        },
        upsert=True
    )
    
    return scores
