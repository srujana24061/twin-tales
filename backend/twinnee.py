"""
TWINNEE - Digital Twin AI Companion
Behavior tracking, scoring, and conversational AI for children
"""

import os
import random
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional
from uuid import uuid4
from openai import OpenAI
import os

# Initialize OpenAI client with EMERGENT_LLM_KEY as fallback
_api_key = os.environ.get('OPENAI_API_KEY') or os.environ.get('EMERGENT_LLM_KEY')
_base_url = None
if not os.environ.get('OPENAI_API_KEY') and os.environ.get('EMERGENT_LLM_KEY'):
    _base_url = "https://api.openai.com/v1"  # Emergent key works with standard OpenAI endpoint

openai_client = OpenAI(api_key=_api_key) if _api_key else None

# TWINNEE System Prompt
TWINNEE_SYSTEM_PROMPT = """You are TWINNEE, a friendly, supportive AI companion for children. You act like a digital twin — understanding the child's habits, preferences, emotions, and learning patterns.

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
    """Calculate behavior scores for TWINNEE"""
    
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



class BehavioralRiskDetector:
    """Detect behavioral patterns and risks"""
    
    @staticmethod
    def detect_risks(user_context: Dict, activities: List[Dict]) -> List[Dict]:
        """
        Detect behavioral risks and return triggers
        
        Returns list of risk triggers with actions
        """
        risks = []
        screen_time = user_context.get('screen_time_today', 0)
        scores = user_context.get('scores', {})
        
        # Screen time > limit (120 minutes = 2 hours)
        if screen_time > 120:
            risks.append({
                'type': 'screen_time_high',
                'severity': 'medium',
                'action': 'soft_reminder',
                'message': "Looks like you've been on screen for a while 😄 Want to try a quick fun challenge or story?"
            })
        
        # Repeated missed tasks
        missed_tasks = [a for a in activities if a.get('activity_type') == 'task' and not a.get('completed')]
        if len(missed_tasks) >= 3:
            risks.append({
                'type': 'missed_tasks',
                'severity': 'medium',
                'action': 'motivation_prompt',
                'message': "Hey, should we finish your pending mission together? 🎯"
            })
        
        # Negative mood streak (emotional score < 50)
        if scores.get('emotional', 75) < 50:
            risks.append({
                'type': 'negative_mood',
                'severity': 'high',
                'action': 'emotional_support',
                'message': "I'm here if you want to talk about anything. Want to create a fun story together? 🌟"
            })
        
        # Low activity (physical score < 40)
        if scores.get('physical', 50) < 40:
            risks.append({
                'type': 'low_activity',
                'severity': 'low',
                'action': 'suggest_movement',
                'message': "How about a quick movement break? Maybe a fun dance or stretch? 💃"
            })
        
        # Sudden behavior change (discipline or emotional drop > 20 points)
        # This would need historical comparison - simplified for now
        if scores.get('discipline', 100) < 40 or scores.get('emotional', 75) < 40:
            risks.append({
                'type': 'behavior_change',
                'severity': 'high',
                'action': 'flag_for_parent',
                'message': None,  # Silent flag
                'parent_alert': True
            })
        
        return risks
    
    @staticmethod
    def should_trigger_nudge(risks: List[Dict], last_nudge_time: datetime = None) -> Dict:
        """
        Determine if a nudge should be triggered
        Respects cooldown period to avoid annoyance
        """
        if not risks:
            return None
        
        # Don't nudge more than once per hour
        if last_nudge_time:
            time_since_last = datetime.now(timezone.utc) - last_nudge_time
            if time_since_last.total_seconds() < 3600:  # 1 hour
                return None
        
        # Prioritize by severity
        high_severity = [r for r in risks if r.get('severity') == 'high']
        if high_severity:
            return high_severity[0]
        
        medium_severity = [r for r in risks if r.get('severity') == 'medium']
        if medium_severity:
            return medium_severity[0]
        
        return risks[0] if risks else None


class PatternLearner:
    """Learn and track user patterns over time"""
    
    @staticmethod
    async def track_pattern(db, user_id: str, pattern_type: str, value: any):
        """
        Track a pattern data point
        
        Pattern types: peak_time, content_preference, attention_span, mood
        """
        pattern_doc = {
            "id": str(uuid4()),
            "user_id": user_id,
            "pattern_type": pattern_type,
            "value": value,
            "timestamp": datetime.now(timezone.utc)
        }
        await db.user_patterns.insert_one(pattern_doc)
    
    @staticmethod
    async def get_patterns(db, user_id: str, days: int = 7) -> Dict:
        """
        Get learned patterns for user
        """
        since = datetime.now(timezone.utc) - timedelta(days=days)
        
        patterns = await db.user_patterns.find(
            {"user_id": user_id, "timestamp": {"$gte": since}}
        ).to_list(1000)
        
        result = {
            'peak_activity_times': [],
            'favorite_content': [],
            'average_attention_span': 0,
            'mood_cycles': []
        }
        
        # Analyze patterns
        peak_times = [p for p in patterns if p.get('pattern_type') == 'peak_time']
        if peak_times:
            # Group by hour of day
            hour_counts = {}
            for p in peak_times:
                hour = p['timestamp'].hour
                hour_counts[hour] = hour_counts.get(hour, 0) + 1
            result['peak_activity_times'] = sorted(hour_counts.items(), key=lambda x: x[1], reverse=True)[:3]
        
        # Favorite content
        content_prefs = [p for p in patterns if p.get('pattern_type') == 'content_preference']
        if content_prefs:
            content_counts = {}
            for p in content_prefs:
                val = p['value']
                content_counts[val] = content_counts.get(val, 0) + 1
            result['favorite_content'] = sorted(content_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        
        # Attention span
        attention = [p for p in patterns if p.get('pattern_type') == 'attention_span']
        if attention:
            result['average_attention_span'] = sum(p['value'] for p in attention) / len(attention)
        
        # Mood cycles
        moods = [p for p in patterns if p.get('pattern_type') == 'mood']
        result['mood_cycles'] = moods[-10:]  # Last 10 mood entries
        
        return result


class StoryPersonalizer:
    """Personalize story suggestions based on behavior and patterns"""
    
    @staticmethod
    def get_story_suggestions(scores: Dict, patterns: Dict, user_interests: List[str] = None) -> List[Dict]:
        """
        Generate personalized story suggestions
        """
        suggestions = []
        
        creativity = scores.get('creativity', 50)
        discipline = scores.get('discipline', 100)
        emotional = scores.get('emotional', 75)
        
        # Low creativity → guided story
        if creativity < 40:
            suggestions.append({
                'type': 'guided',
                'title': 'The Magical Adventure',
                'description': 'Follow the hero through exciting choices!',
                'reason': 'This story will spark your creativity! 🎨'
            })
        
        # High creativity → open-ended story
        if creativity >= 70:
            suggestions.append({
                'type': 'open_ended',
                'title': 'Create Your Own World',
                'description': 'Build anything you can imagine!',
                'reason': "You're so creative! Let your imagination run wild! ✨"
            })
        
        # Low discipline → moral story
        if discipline < 40:
            suggestions.append({
                'type': 'moral',
                'title': 'The Persistent Hero',
                'description': 'Learn about never giving up!',
                'reason': 'A story about finishing what you start 🎯'
            })
        
        # Low emotional → comforting story
        if emotional < 50:
            suggestions.append({
                'type': 'comforting',
                'title': 'The Friendly Dragon',
                'description': 'A heartwarming tale of friendship',
                'reason': 'This story will make you smile! 😊'
            })
        
        # Based on interests
        if user_interests:
            for interest in user_interests[:2]:
                suggestions.append({
                    'type': 'interest_based',
                    'title': f'Adventure with {interest.title()}',
                    'description': f'A story about your favorite: {interest}!',
                    'reason': f'You love {interest}! 💖'
                })
        
        # Based on favorite content patterns
        if patterns.get('favorite_content'):
            top_content = patterns['favorite_content'][0][0]
            suggestions.append({
                'type': 'pattern_based',
                'title': f'More {top_content}',
                'description': 'Similar to stories you enjoyed before',
                'reason': 'Based on what you like! 🌟'
            })
        
        return suggestions[:5]  # Return top 5


class TwinneeChat:
    """TWINNEE Chatbot with emergentintegrations"""
    
    def __init__(self):
        self.system_prompt = TWINNEE_SYSTEM_PROMPT
        self._key = os.environ.get('EMERGENT_LLM_KEY') or os.environ.get('OPENAI_API_KEY')
    
    async def get_response(
        self, 
        user_message: str, 
        conversation_history: List[Dict] = None,
        user_context: Dict = None
    ) -> str:
        """
        Get chatbot response using emergentintegrations
        """
        if not self._key:
            return "I need a moment! Please check back soon. 😊"

        # Build context-aware system prompt
        context_prompt = self.system_prompt
        
        if user_context:
            scores = user_context.get('scores', {})
            screen_time = user_context.get('screen_time_today', 0)
            context_prompt += "\n\nCURRENT CONTEXT:"
            context_prompt += f"\n- Child's name: {user_context.get('child_name', 'friend')}"
            context_prompt += f"\n- Screen time today: {screen_time} minutes"
            if scores:
                if scores.get('creativity', 0) < 40:
                    context_prompt += "\n- Note: Encourage creative activities"
                if scores.get('discipline', 0) < 40:
                    context_prompt += "\n- Note: Gently remind about completing tasks"
                if scores.get('emotional', 0) < 50:
                    context_prompt += "\n- Note: Be extra supportive and uplifting"
            # Safety nudge from Responsible AI
            if user_context.get('safety_nudge'):
                context_prompt += f"\n- IMPORTANT: Weave this gentle message naturally into your response: {user_context['safety_nudge']}"
        
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            # Use unique session per conversation (last 5 history messages as context)
            session_key = hash(user_message[:20]) % 99999
            chat = LlmChat(
                api_key=self._key,
                session_id=f"twinnee_{user_context.get('child_name','u') if user_context else 'u'}_{session_key}",
                system_message=context_prompt
            ).with_model("openai", "gpt-4o-mini")

            # Add conversation history
            if conversation_history:
                for conv in conversation_history[-5:]:
                    if conv.get('user_message') and conv.get('bot_response'):
                        chat.add_message("user", conv['user_message'])
                        chat.add_message("assistant", conv['bot_response'])

            response = await chat.send_message(UserMessage(text=user_message))
            return response.strip() if response else "I'm here with you! 😊"

        except Exception:
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
