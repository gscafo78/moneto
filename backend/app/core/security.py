from datetime import datetime, timedelta
from jose import jwt, JWTError
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.db.session import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# ── Token creation ─────────────────────────────────────────────────────────────

def create_access_token(user_id: str, remember_me: bool = False) -> str:
    """Short-lived access token. With remember_me it lasts 24 h (48×), otherwise 30 min."""
    minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 48 if remember_me else settings.ACCESS_TOKEN_EXPIRE_MINUTES
    expire = datetime.utcnow() + timedelta(minutes=minutes)
    return jwt.encode(
        {"sub": user_id, "exp": expire, "type": "access"},
        settings.SECRET_KEY, algorithm=settings.ALGORITHM,
    )


def create_refresh_token(user_id: str, remember_me: bool = False) -> str:
    """Long-lived refresh token. `rem` flag is embedded so it propagates on every rotation."""
    days = settings.REMEMBER_ME_EXPIRE_DAYS if remember_me else settings.REFRESH_TOKEN_EXPIRE_DAYS
    expire = datetime.utcnow() + timedelta(days=days)
    return jwt.encode(
        {"sub": user_id, "exp": expire, "type": "refresh", "rem": remember_me},
        settings.SECRET_KEY, algorithm=settings.ALGORITHM,
    )


def create_mfa_session_token(user_id: str) -> str:
    """5-minute one-use token issued after correct password; consumed by /auth/mfa/verify."""
    expire = datetime.utcnow() + timedelta(minutes=5)
    return jwt.encode(
        {"sub": user_id, "exp": expire, "type": "mfa_session"},
        settings.SECRET_KEY, algorithm=settings.ALGORITHM,
    )


# ── Token decoding ─────────────────────────────────────────────────────────────

def decode_token(token: str) -> dict:
    """Decode and return payload. Raises HTTPException on failure."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Token non valido")


def verify_access_token(token: str) -> str:
    """Decode access token and return user_id. Rejects non-access token types."""
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Token non valido")
    user_id: str = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token non valido")
    return user_id


# ── FastAPI dependency ─────────────────────────────────────────────────────────

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    from app.models.user import User  # local import avoids circular deps
    user_id = verify_access_token(token)
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Utente non trovato")
    return user
