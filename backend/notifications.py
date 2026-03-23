"""
Notification service for email and WhatsApp notifications
"""
import os
import asyncio
import logging
from typing import Optional
from twilio.rest import Client
from backend.ses_notifications import send_video_complete_email_ses

logger = logging.getLogger(__name__)

# Initialize Twilio
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN', '')
TWILIO_WHATSAPP_FROM = os.environ.get('TWILIO_WHATSAPP_FROM', 'whatsapp:+14155238886')

# Initialize Twilio
twilio_client = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    try:
        twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    except Exception as e:
        logger.warning(f"Failed to initialize Twilio client: {e}")


async def send_video_complete_email(
    recipient_email: str,
    story_title: str,
    video_url: str,
    parent_email: Optional[str] = None
) -> dict:
    """Send email notification when video generation completes (using SES)"""
    return await send_video_complete_email_ses(
        recipient_email=recipient_email,
        story_title=story_title,
        video_url=video_url,
        parent_email=parent_email
    )


async def send_video_complete_whatsapp(
    phone_number: str,
    story_title: str,
    video_url: str
) -> dict:
    """Send WhatsApp notification when video generation completes"""
    if not twilio_client:
        logger.warning("Twilio client not configured, skipping WhatsApp")
        return {"status": "skipped", "reason": "no_twilio_client"}
    
    if not phone_number or not phone_number.startswith('+'):
        logger.warning(f"Invalid phone number format: {phone_number}")
        return {"status": "skipped", "reason": "invalid_phone"}
    
    message_body = f"""🎉 *Your Story Video is Ready!*

"{story_title}"

Your animated story has been generated! 🎬

View it here: {video_url}

✨ Twinnee AI
"""
    
    try:
        message = await asyncio.to_thread(
            twilio_client.messages.create,
            from_=TWILIO_WHATSAPP_FROM,
            body=message_body,
            to=f"whatsapp:{phone_number}"
        )
        logger.info(f"WhatsApp sent successfully to {phone_number}: {message.sid}")
        return {
            "status": "success",
            "message_sid": message.sid,
            "phone": phone_number
        }
    except Exception as e:
        logger.error(f"Failed to send WhatsApp to {phone_number}: {e}")
        return {"status": "failed", "error": str(e)}


async def notify_video_complete(
    user_email: str,
    parent_email: Optional[str],
    phone_number: Optional[str],
    story_title: str,
    video_url: str
) -> dict:
    """
    Send all notifications (email + WhatsApp) when video generation completes
    Returns combined status of all notification attempts
    """
    results = {
        "email": None,
        "whatsapp": None
    }
    
    # Send email
    results["email"] = await send_video_complete_email(
        recipient_email=user_email,
        story_title=story_title,
        video_url=video_url,
        parent_email=parent_email
    )
    
    # Send WhatsApp
    if phone_number:
        results["whatsapp"] = await send_video_complete_whatsapp(
            phone_number=phone_number,
            story_title=story_title,
            video_url=video_url
        )
    else:
        results["whatsapp"] = {"status": "skipped", "reason": "no_phone_number"}
    
    logger.info(f"Notifications sent for '{story_title}': {results}")
    return results
