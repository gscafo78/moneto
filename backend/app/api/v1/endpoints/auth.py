import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.models.account import Account
from app.models.app_settings import AppSettings
from app.services.email import (
    send_verification_email,
    send_password_reset_email,
    send_test_email,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_mfa_session_token,
    decode_token,
    get_current_user,
)

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

VERIFICATION_TOKEN_HOURS = 24
RESET_TOKEN_HOURS = 1


async def _get_app_settings(db: AsyncSession) -> AppSettings:
    result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    app_settings = result.scalar_one_or_none()
    if not app_settings:
        app_settings = AppSettings(id=1, allow_registration=False)
        db.add(app_settings)
        await db.commit()
        await db.refresh(app_settings)
    return app_settings


# ── Schemas ────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "bearer"
    requires_mfa: bool = False
    session_token: str | None = None


class UserOut(BaseModel):
    id: str
    email: str
    name: str | None
    totp_enabled: bool = False
    currency: str = "EUR"
    default_account_id: str | None = None
    email_verified: bool = False
    is_admin: bool = False

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    currency: str | None = None
    default_account_id: str | None = None
    clear_default_account: bool = False


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class VerifyEmailRequest(BaseModel):
    token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class RegistrationSetting(BaseModel):
    allow_registration: bool


class SmtpSettingsOut(BaseModel):
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_user: str | None = None
    smtp_from: str | None = None
    smtp_tls: bool | None = None
    smtp_password_set: bool = False


class SmtpSettingsUpdate(BaseModel):
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None
    smtp_tls: bool | None = None


# ── Helpers ────────────────────────────────────────────────────────────────────

def _tokens(user: User, remember_me: bool = False) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(str(user.id), remember_me=remember_me),
        refresh_token=create_refresh_token(str(user.id), remember_me=remember_me),
    )


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/registration-open")
async def registration_open(db: AsyncSession = Depends(get_db)):
    """Restituisce se la registrazione pubblica è attiva (usato dal frontend)."""
    app_settings = await _get_app_settings(db)
    if settings.ALLOW_REGISTRATION or app_settings.allow_registration:
        return {"open": True}
    count_result = await db.execute(select(User))
    has_users = count_result.scalars().first() is not None
    return {"open": not has_users}


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(data: UserCreate, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    # Controlla se esistono già utenti
    count_result = await db.execute(select(User))
    has_users = count_result.scalars().first() is not None

    # Blocca la registrazione se ci sono già utenti e la registrazione pubblica è disabilitata
    app_settings = await _get_app_settings(db)
    if has_users and not settings.ALLOW_REGISTRATION and not app_settings.allow_registration:
        raise HTTPException(
            status_code=403,
            detail="La registrazione pubblica è disabilitata. Contatta l'amministratore.",
        )

    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email già registrata")

    verification_token = secrets.token_urlsafe(32)
    user = User(
        email=data.email,
        hashed_password=pwd_context.hash(data.password),
        name=data.name,
        is_admin=not has_users,
        email_verified=False,
        verification_token=verification_token,
        verification_token_expires=datetime.now(timezone.utc) + timedelta(hours=VERIFICATION_TOKEN_HOURS),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    background_tasks.add_task(send_verification_email, user.email, verification_token)
    return _tokens(user, remember_me=False)


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not pwd_context.verify(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Credenziali non valide")

    # Se MFA attivo → session token a 5 min (remember_me propagato al verify step)
    if getattr(user, "totp_enabled", False):
        return TokenResponse(
            requires_mfa=True,
            session_token=create_mfa_session_token(str(user.id)),
        )

    return _tokens(user, remember_me=data.remember_me)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshRequest):
    """Rinnova l'access token usando il refresh token.
    Il flag `rem` nel refresh token propaga automaticamente remember_me."""
    payload = decode_token(body.refresh_token)
    if payload.get("type") != "refresh" or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Refresh token non valido")
    user_id: str = payload["sub"]
    remember_me: bool = bool(payload.get("rem", False))
    return TokenResponse(
        access_token=create_access_token(user_id, remember_me=remember_me),
        refresh_token=create_refresh_token(user_id, remember_me=remember_me),
    )


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=str(user.id),
        email=user.email,
        name=user.name,
        totp_enabled=user.totp_enabled,
        currency=user.currency,
        default_account_id=str(user.default_account_id) if user.default_account_id else None,
        email_verified=user.email_verified,
        is_admin=user.is_admin,
    )


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return _user_out(current_user)


@router.patch("/me", response_model=UserOut)
async def update_me(
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.currency is not None:
        currency = data.currency.strip().upper()
        if len(currency) != 3:
            raise HTTPException(status_code=400, detail="Codice valuta non valido")
        current_user.currency = currency

    if data.clear_default_account:
        current_user.default_account_id = None
    elif data.default_account_id is not None:
        result = await db.execute(
            select(Account).where(Account.id == data.default_account_id, Account.user_id == current_user.id)
        )
        account = result.scalar_one_or_none()
        if not account:
            raise HTTPException(status_code=404, detail="Conto non trovato")
        current_user.default_account_id = account.id

    await db.commit()
    await db.refresh(current_user)
    return _user_out(current_user)


# ── Verifica email ─────────────────────────────────────────────────────────────

@router.post("/verify-email")
async def verify_email(data: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.verification_token == data.token))
    user = result.scalar_one_or_none()
    if not user or not user.verification_token_expires or user.verification_token_expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Link di verifica non valido o scaduto")

    user.email_verified = True
    user.verification_token = None
    user.verification_token_expires = None
    await db.commit()
    return {"detail": "Email verificata con successo"}


@router.post("/resend-verification")
async def resend_verification(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.email_verified:
        return {"detail": "Email già verificata"}

    current_user.verification_token = secrets.token_urlsafe(32)
    current_user.verification_token_expires = datetime.now(timezone.utc) + timedelta(hours=VERIFICATION_TOKEN_HOURS)
    await db.commit()
    background_tasks.add_task(send_verification_email, current_user.email, current_user.verification_token)
    return {"detail": "Email di verifica inviata"}


# ── Reset password ────────────────────────────────────────────────────────────

@router.post("/forgot-password")
async def forgot_password(
    data: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if user:
        user.reset_token = secrets.token_urlsafe(32)
        user.reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=RESET_TOKEN_HOURS)
        await db.commit()
        background_tasks.add_task(send_password_reset_email, user.email, user.reset_token)

    return {"detail": "Se l'indirizzo esiste, riceverai un'email con le istruzioni per il reset"}


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.reset_token == data.token))
    user = result.scalar_one_or_none()
    if not user or not user.reset_token_expires or user.reset_token_expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Link di reset non valido o scaduto")

    user.hashed_password = pwd_context.hash(data.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    await db.commit()
    return {"detail": "Password aggiornata con successo"}


# ── Cambio password ────────────────────────────────────────────────────────────

@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not pwd_context.verify(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Password attuale non corretta")

    current_user.hashed_password = pwd_context.hash(data.new_password)
    await db.commit()
    return {"detail": "Password aggiornata con successo"}


# ── Amministrazione ───────────────────────────────────────────────────────────

@router.get("/admin/registration", response_model=RegistrationSetting)
async def get_registration_setting(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Accesso riservato agli amministratori")
    app_settings = await _get_app_settings(db)
    return RegistrationSetting(allow_registration=app_settings.allow_registration)


@router.patch("/admin/registration", response_model=RegistrationSetting)
async def set_registration_setting(
    data: RegistrationSetting,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Accesso riservato agli amministratori")
    app_settings = await _get_app_settings(db)
    app_settings.allow_registration = data.allow_registration
    await db.commit()
    return RegistrationSetting(allow_registration=app_settings.allow_registration)


def _smtp_out(app_settings: AppSettings) -> SmtpSettingsOut:
    return SmtpSettingsOut(
        smtp_host=app_settings.smtp_host,
        smtp_port=app_settings.smtp_port,
        smtp_user=app_settings.smtp_user,
        smtp_from=app_settings.smtp_from,
        smtp_tls=app_settings.smtp_tls,
        smtp_password_set=bool(app_settings.smtp_password),
    )


@router.get("/admin/smtp", response_model=SmtpSettingsOut)
async def get_smtp_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Accesso riservato agli amministratori")
    app_settings = await _get_app_settings(db)
    return _smtp_out(app_settings)


@router.patch("/admin/smtp", response_model=SmtpSettingsOut)
async def update_smtp_settings(
    data: SmtpSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Accesso riservato agli amministratori")
    app_settings = await _get_app_settings(db)
    update_data = data.model_dump(exclude_unset=True)

    if "smtp_host" in update_data:
        app_settings.smtp_host = update_data["smtp_host"] or None
    if "smtp_port" in update_data:
        app_settings.smtp_port = update_data["smtp_port"]
    if "smtp_user" in update_data:
        app_settings.smtp_user = update_data["smtp_user"] or None
    if "smtp_password" in update_data and update_data["smtp_password"]:
        app_settings.smtp_password = update_data["smtp_password"]
    if "smtp_from" in update_data:
        app_settings.smtp_from = update_data["smtp_from"] or None
    if "smtp_tls" in update_data:
        app_settings.smtp_tls = update_data["smtp_tls"]

    await db.commit()
    return _smtp_out(app_settings)


@router.post("/admin/smtp/test")
async def test_smtp_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Accesso riservato agli amministratori")
    app_settings = await _get_app_settings(db)
    if not app_settings.smtp_host and not settings.SMTP_HOST:
        raise HTTPException(status_code=400, detail="Configura prima un host SMTP")
    try:
        await send_test_email(current_user.email)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invio fallito: {exc}")
    return {"detail": f"Email di prova inviata a {current_user.email}"}
