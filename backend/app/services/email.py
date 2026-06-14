import logging
import aiosmtplib
from email.message import EmailMessage
from sqlalchemy import select
from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.app_settings import AppSettings

logger = logging.getLogger(__name__)


async def _smtp_config() -> tuple[str, int, str, str, str, bool]:
    """Configurazione SMTP effettiva: valori salvati in app_settings (DB) hanno
    la precedenza su quelli da variabili d'ambiente."""
    host, port, user, password, from_addr, tls = (
        settings.SMTP_HOST, settings.SMTP_PORT, settings.SMTP_USER,
        settings.SMTP_PASSWORD, settings.SMTP_FROM, settings.SMTP_TLS,
    )

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
        app_settings = result.scalar_one_or_none()
        if app_settings and app_settings.smtp_host:
            host = app_settings.smtp_host
            port = app_settings.smtp_port or port
            user = app_settings.smtp_user or ""
            password = app_settings.smtp_password or ""
            from_addr = app_settings.smtp_from or from_addr
            if app_settings.smtp_tls is not None:
                tls = app_settings.smtp_tls

    return host, port, user, password, from_addr, tls


async def send_email(to: str, subject: str, html_body: str) -> None:
    host, port, user, password, from_addr, tls = await _smtp_config()
    if not host:
        logger.info("[email] SMTP non configurato, invio simulato a %s — %s\n%s", to, subject, html_body)
        return

    msg = EmailMessage()
    msg["From"] = from_addr
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(html_body, subtype="html")

    # Porta 465 = TLS implicito; le altre porte (es. 587, 25) usano STARTTLS
    if port == 465:
        await aiosmtplib.send(
            msg, hostname=host, port=port,
            username=user or None, password=password or None,
            use_tls=True,
        )
    else:
        await aiosmtplib.send(
            msg, hostname=host, port=port,
            username=user or None, password=password or None,
            start_tls=tls,
        )


def _wrapper(title: str, body_html: str) -> str:
    return f"""
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1f1f28;">
      <h2 style="color: #6366f1;">{title}</h2>
      {body_html}
      <p style="color: #888; font-size: 12px; margin-top: 32px;">Moneto — gestione spese personali</p>
    </div>
    """


async def send_verification_email(to: str, token: str) -> None:
    link = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    body = _wrapper("Conferma la tua iscrizione", f"""
      <p>Grazie per esserti registrato su Moneto. Conferma il tuo indirizzo email cliccando sul link sotto:</p>
      <p><a href="{link}" style="color: #6366f1;">Conferma la tua email</a></p>
      <p>Il link è valido per 24 ore. Se non hai richiesto questa registrazione, ignora questa email.</p>
    """)
    await send_email(to, "Conferma la tua iscrizione a Moneto", body)


async def send_password_reset_email(to: str, token: str) -> None:
    link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    body = _wrapper("Reimposta la tua password", f"""
      <p>Hai richiesto di reimpostare la password del tuo account Moneto. Clicca sul link sotto per scegliere una nuova password:</p>
      <p><a href="{link}" style="color: #6366f1;">Reimposta password</a></p>
      <p>Il link è valido per 1 ora. Se non hai richiesto questa operazione, ignora questa email.</p>
    """)
    await send_email(to, "Reimposta la tua password Moneto", body)


async def send_test_email(to: str) -> None:
    body = _wrapper("Email di prova", """
      <p>Questa è un'email di prova per verificare la configurazione SMTP di Moneto.</p>
      <p>Se la stai leggendo, la configurazione funziona correttamente.</p>
    """)
    await send_email(to, "Moneto — email di prova", body)
