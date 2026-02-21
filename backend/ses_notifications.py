"""
Amazon SES notification service for email
"""
import os
import logging
from typing import Optional
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

# Initialize SES client
AWS_REGION = os.environ.get('AWS_REGION', 'ap-south-1')
AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID', '')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY', '')
SES_FROM_EMAIL = os.environ.get('SES_FROM_EMAIL', 'satyendra@srujana.solutions')

ses_client = None
if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
    try:
        ses_client = boto3.client(
            'ses',
            region_name=AWS_REGION,
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY
        )
        logger.info(f"SES client initialized for region {AWS_REGION}")
    except Exception as e:
        logger.warning(f"Failed to initialize SES client: {e}")


async def send_video_complete_email_ses(
    recipient_email: str,
    story_title: str,
    video_url: str,
    parent_email: Optional[str] = None
) -> dict:
    """Send email notification via Amazon SES when video generation completes"""
    if not ses_client:
        logger.warning("SES client not configured, skipping email")
        return {"status": "skipped", "reason": "no_ses_client"}
    
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
        response = ses_client.send_email(
            Source=SES_FROM_EMAIL,
            Destination={'ToAddresses': recipients},
            Message={
                'Subject': {'Data': f'✨ Your Story Video is Ready: {story_title}', 'Charset': 'UTF-8'},
                'Body': {'Html': {'Data': html_content, 'Charset': 'UTF-8'}}
            }
        )
        logger.info(f"SES email sent successfully to {recipients}: {response['MessageId']}")
        return {
            "status": "success",
            "message_id": response['MessageId'],
            "recipients": recipients
        }
    except ClientError as e:
        logger.error(f"Failed to send SES email: {e.response['Error']['Message']}")
        return {"status": "failed", "error": e.response['Error']['Message']}
    except Exception as e:
        logger.error(f"Failed to send SES email: {e}")
        return {"status": "failed", "error": str(e)}
