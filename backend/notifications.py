"""
Notification service for email and WhatsApp notifications
"""
import os
import asyncio
import logging
from typing import Optional
import resend
from twilio.rest import Client

logger = logging.getLogger(__name__)

# Initialize services
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN', '')
TWILIO_WHATSAPP_FROM = os.environ.get('TWILIO_WHATSAPP_FROM', 'whatsapp:+14155238886')

# Initialize Resend
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

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
    """Send email notification when video generation completes"""
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured, skipping email")
        return {"status": "skipped", "reason": "no_api_key"}
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }}
            .container {{ max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
            .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; }}
            .header h1 {{ color: white; margin: 0; font-size: 24px; }}
            .content {{ padding: 30px; }}
            .content h2 {{ color: #333; margin-top: 0; }}
            .content p {{ color: #666; line-height: 1.6; }}
            .cta-button {{ display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }}
            .footer {{ background: #f9f9f9; padding: 20px; text-align: center; color: #999; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>✨ Your Story Video is Ready!</h1>
            </div>
            <div class="content">
                <h2>"{story_title}"</h2>
                <p>Great news! Your animated story video has been successfully generated and is ready to watch.</p>
                <p>Click the button below to view your magical story:</p>
                <a href="{video_url}" class="cta-button">Watch Your Story</a>
                <p style="margin-top: 30px; color: #999; font-size: 14px;">
                    You can also download the video and share it with family and friends!
                </p>
            </div>
            <div class="footer">
                <p>StoryCraft AI - Where imagination comes to life 🎨</p>
                <p>This is an automated notification email</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    recipients = [recipient_email]
    if parent_email and parent_email != recipient_email:
        recipients.append(parent_email)
    
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": recipients,
            "subject": f"✨ Your Story Video is Ready: {story_title}",
            "html": html_content
        }
        
        # Run sync SDK in thread to keep non-blocking
        email_response = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent successfully to {recipients}: {email_response.get('id')}")
        return {
            "status": "success",
            "email_id": email_response.get("id"),
            "recipients": recipients
        }
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return {"status": "failed", "error": str(e)}


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

✨ StoryCraft AI
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
