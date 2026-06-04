from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from app.db.session import get_db
from app.models.user import User
from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_mfa_session_token,
    decode_token,
    get_current_user,
)

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


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

    model_config = {"from_attributes": True}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _tokens(user: User, remember_me: bool = False) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(str(user.id), remember_me=remember_me),
        refresh_token=create_refresh_token(str(user.id), remember_me=remember_me),
    )


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email già registrata")
    user = User(
        email=data.email,
        hashed_password=pwd_context.hash(data.password),
        name=data.name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    # Primo accesso: nessun "Ricordami", token breve
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


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return UserOut(
        id=str(current_user.id),
        email=current_user.email,
        name=current_user.name,
    )
