"""Application-wide SMTP email client for real notifications (reminders,
household invites). Mirrors posthog_client.py's shape: settings loaded from
the environment, a safe no-op when unconfigured so local dev without
credentials never crashes a request."""

import base64
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from functools import lru_cache
from io import BytesIO

import qrcode
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Optional SMTP settings loaded from the environment."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    love21_smtp_host: str = "smtp.gmail.com"
    love21_smtp_port: int = 587
    love21_smtp_user: str | None = None
    love21_smtp_password: str | None = None
    love21_from_email: str | None = None
    love21_from_name: str = "Love 21 Foundation"
    love21_frontend_base_url: str = "http://127.0.0.1:8765"


@lru_cache
def get_settings() -> Settings:
    """Return cached settings, allowing dependency overrides in tests."""
    return Settings()


def send_email(
    to_email: str, subject: str, text_body: str, html_body: str | None = None
) -> bool:
    """Send a real email via SMTP. Returns False (and logs) instead of
    raising when SMTP isn't configured, so the rest of the request/job
    that triggered this can proceed normally either way."""
    settings = get_settings()
    if not settings.love21_smtp_user or not settings.love21_smtp_password:
        # No SMTP configured — print the body too (not just the subject) so
        # invite codes/links are actually usable for local testing without
        # needing to open the database.
        logger.warning(
            "SMTP not configured (set LOVE21_SMTP_USER / LOVE21_SMTP_PASSWORD "
            "in backend/.env) — would have sent to %s\nSubject: %s\n%s",
            to_email,
            subject,
            text_body,
        )
        return False

    from_email = settings.love21_from_email or settings.love21_smtp_user
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.love21_from_name} <{from_email}>"
    msg["To"] = to_email
    msg.attach(MIMEText(text_body, "plain"))
    if html_body:
        msg.attach(MIMEText(html_body, "html"))

    try:
        # Port 465 is implicit TLS (SMTP_SSL); anything else assumes STARTTLS
        # on a plaintext connection (the traditional port-587 flow). Some
        # networks block outbound 587 but allow 465, so both are supported.
        if settings.love21_smtp_port == 465:
            server_cm = smtplib.SMTP_SSL(
                settings.love21_smtp_host, settings.love21_smtp_port, timeout=10
            )
        else:
            server_cm = smtplib.SMTP(
                settings.love21_smtp_host, settings.love21_smtp_port, timeout=10
            )
        with server_cm as server:
            if settings.love21_smtp_port != 465:
                server.starttls()
            server.login(settings.love21_smtp_user, settings.love21_smtp_password)
            server.sendmail(from_email, [to_email], msg.as_string())
        return True
    except Exception:
        logger.exception("Failed to send email to %s", to_email)
        return False


def qr_data_uri(data: str) -> str:
    """Render `data` (e.g. an invite link) as a QR code PNG, base64-encoded
    for direct embedding in an <img src="..."> tag inside an email body."""
    img = qrcode.make(data)
    buf = BytesIO()
    img.save(buf, format="PNG")
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def frontend_url(path: str) -> str:
    base = get_settings().love21_frontend_base_url.rstrip("/")
    return f"{base}/{path.lstrip('/')}"
