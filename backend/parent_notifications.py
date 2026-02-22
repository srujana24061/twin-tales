"""
Notification service for TWINNEE Parent Alerts
- Email via Amazon SES
- WhatsApp via Twilio
"""

import os
import logging
from typing import Optional
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

# ---------- SES Email ----------
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
    except Exception as e:
        logger.warning(f"SES init failed: {e}")

# ---------- Twilio WhatsApp ----------
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN', '')
TWILIO_WHATSAPP_FROM = os.environ.get('TWILIO_WHATSAPP_FROM', 'whatsapp:+14155238886')

twilio_client = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    try:
        from twilio.rest import Client as TwilioClient
        twilio_client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        logger.info("Twilio client initialized")
    except Exception as e:
        logger.warning(f"Twilio init failed: {e}")


def _severity_color(severity: str) -> str:
    return {
        "CRITICAL": "#DC2626",
        "HIGH": "#EA580C",
        "MEDIUM": "#D97706",
        "LOW": "#65A30D",
    }.get(severity, "#6366F1")


def _severity_emoji(severity: str) -> str:
    return {
        "CRITICAL": "🚨",
        "HIGH": "⚠️",
        "MEDIUM": "⚡",
        "LOW": "💛",
    }.get(severity, "ℹ️")


async def send_whatsapp_message(phone: str, message: str) -> dict:
    """Send a WhatsApp message via Twilio."""
    if not twilio_client:
        logger.warning("Twilio not configured — skipping WhatsApp")
        return {"status": "skipped", "reason": "twilio_not_configured"}

    # Ensure E.164 format: strip leading zeros, add country code if needed
    to_number = phone.strip()
    if not to_number.startswith('+'):
        to_number = '+' + to_number
    wa_to = f"whatsapp:{to_number}"

    try:
        msg = twilio_client.messages.create(
            from_=TWILIO_WHATSAPP_FROM,
            body=message,
            to=wa_to
        )
        logger.info(f"WhatsApp sent to {wa_to}: {msg.sid}")
        return {"status": "success", "sid": msg.sid}
    except Exception as e:
        logger.error(f"WhatsApp send failed: {e}")
        return {"status": "failed", "error": str(e)}


async def send_email_alert(
    recipient_email: str,
    subject: str,
    html_body: str
) -> dict:
    """Send an alert email via Amazon SES."""
    if not ses_client:
        logger.warning("SES not configured — skipping email")
        return {"status": "skipped", "reason": "ses_not_configured"}
    try:
        response = ses_client.send_email(
            Source=SES_FROM_EMAIL,
            Destination={'ToAddresses': [recipient_email]},
            Message={
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': {'Html': {'Data': html_body, 'Charset': 'UTF-8'}}
            }
        )
        logger.info(f"Email sent to {recipient_email}: {response['MessageId']}")
        return {"status": "success", "message_id": response['MessageId']}
    except ClientError as e:
        logger.error(f"SES email failed: {e.response['Error']['Message']}")
        return {"status": "failed", "error": e.response['Error']['Message']}
    except Exception as e:
        logger.error(f"SES email failed: {e}")
        return {"status": "failed", "error": str(e)}


async def send_red_flag_alert(
    child_name: str,
    severity: str,
    summary: str,
    action_steps: list,
    child_message: str,
    parent_email: Optional[str] = None,
    parent_phone: Optional[str] = None,
) -> dict:
    """Send red flag alert to parent via email + WhatsApp."""
    color = _severity_color(severity)
    emoji = _severity_emoji(severity)
    steps_html = "".join(
        f"<li style='margin-bottom:8px;'>{s}</li>" for s in action_steps
    )
    steps_wa = "\n".join(f"{i+1}. {s}" for i, s in enumerate(action_steps))

    # ---- HTML Email ----
    html_body = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
  body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0;background:#f5f5f5}}
  .wrap{{max-width:600px;margin:20px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.12)}}
  .header{{background:{color};padding:28px;text-align:center}}
  .header h1{{color:#fff;margin:0;font-size:22px}}
  .header p{{color:rgba(255,255,255,.85);margin:6px 0 0;font-size:14px}}
  .body{{padding:28px}}
  .alert-box{{background:{color}12;border-left:4px solid {color};padding:16px;border-radius:8px;margin-bottom:20px}}
  .alert-box p{{margin:0;color:#1a1a1a;font-size:14px;line-height:1.6}}
  h2{{color:#1a1a1a;font-size:16px;margin:0 0 12px}}
  ul{{margin:0;padding-left:20px;color:#333;font-size:14px;line-height:1.8}}
  .badge{{display:inline-block;padding:4px 12px;border-radius:20px;background:{color};color:#fff;font-size:12px;font-weight:700;margin-bottom:16px}}
  .footer{{background:#f9f9f9;padding:20px;text-align:center;color:#999;font-size:12px}}
  .cta{{display:inline-block;background:#667eea;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600;margin-top:16px;font-size:14px}}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>{emoji} TWINNEE Parent Alert</h1>
    <p>A {severity.lower()}-severity concern was detected in {child_name}'s conversation</p>
  </div>
  <div class="body">
    <span class="badge">{severity} SEVERITY</span>
    <h2>What was detected</h2>
    <div class="alert-box">
      <p><strong>Summary:</strong> {summary}</p>
      <p style="margin-top:10px;font-style:italic;color:#666;">"{child_message}"</p>
    </div>
    <h2>Recommended Action Steps</h2>
    <ul>{steps_html}</ul>
    <p style="margin-top:20px;font-size:13px;color:#666;line-height:1.7;">
      TWINNEE has already responded to your child with a warm, supportive message.
      These steps are to help you follow up as a parent.
    </p>
    <a href="#" class="cta">Open Parent Dashboard</a>
  </div>
  <div class="footer">
    <p>TWINNEE — Keeping children safe and supported 💙</p>
    <p>This alert was auto-generated by TWINNEE's Responsible AI system.</p>
  </div>
</div>
</body>
</html>"""

    # ---- WhatsApp message ----
    wa_message = f"""{emoji} *TWINNEE Parent Alert — {severity} Severity*

*{child_name}'s recent message needs your attention.*

*What was detected:*
{summary}

*Recommended steps:*
{steps_wa}

TWINNEE has responded supportively to your child. Please follow up when possible.

Open the TWINNEE Parent Dashboard for full details."""

    results = {}
    email_subject = f"{emoji} TWINNEE Alert [{severity}]: {child_name} needs your attention"

    if parent_email:
        results['email'] = await send_email_alert(parent_email, email_subject, html_body)

    if parent_phone:
        results['whatsapp'] = await send_whatsapp_message(parent_phone, wa_message)

    return results


async def send_weekly_report_notification(
    child_name: str,
    report_text: str,
    parent_email: Optional[str] = None,
    parent_phone: Optional[str] = None,
    scores: dict = None,
) -> dict:
    """Send the weekly behaviour report via email + WhatsApp."""
    scores = scores or {}
    overall = scores.get("overall", 50)

    # Email HTML
    score_rows = "".join(
        f"<tr><td style='padding:6px 12px;color:#555;'>{k.title()}</td>"
        f"<td style='padding:6px 12px;'><div style='background:#e5e7eb;border-radius:20px;height:8px;width:120px'>"
        f"<div style='background:#667eea;width:{int(v)}%;height:8px;border-radius:20px'></div></div></td>"
        f"<td style='padding:6px 12px;font-weight:700;color:#667eea;'>{int(v)}</td></tr>"
        for k, v in scores.items() if k != "overall"
    )

    html_body = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
  body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0;background:#f5f5f5}}
  .wrap{{max-width:600px;margin:20px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.12)}}
  .header{{background:linear-gradient(135deg,#667eea,#764ba2);padding:28px;text-align:center}}
  .header h1{{color:#fff;margin:0;font-size:22px}}
  .body{{padding:28px}}
  h2{{color:#1a1a1a;font-size:16px;margin:20px 0 12px}}
  table{{width:100%;border-collapse:collapse}}
  .score-circle{{display:inline-block;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:800;margin:0 auto 8px}}
  .footer{{background:#f9f9f9;padding:20px;text-align:center;color:#999;font-size:12px}}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>📊 Weekly Report — {child_name}</h1>
  </div>
  <div class="body">
    <div style="text-align:center;margin-bottom:24px">
      <div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:28px;font-weight:800">{int(overall)}</div>
      <p style="color:#888;margin:8px 0 0;font-size:13px;">Overall Score / 100</p>
    </div>
    <h2>Behavior Scores</h2>
    <table>{score_rows}</table>
    <h2>Full Analysis</h2>
    <div style="background:#f8f8ff;padding:16px;border-radius:8px;font-size:14px;color:#333;white-space:pre-line;line-height:1.7">{report_text}</div>
  </div>
  <div class="footer">TWINNEE — Keeping children safe and supported 💙</div>
</div>
</body>
</html>"""

    results = {}
    if parent_email:
        results['email'] = await send_email_alert(
            parent_email,
            f"📊 TWINNEE Weekly Report for {child_name}",
            html_body
        )
    if parent_phone:
        results['whatsapp'] = await send_whatsapp_message(parent_phone, report_text)

    return results
