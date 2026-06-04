from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.db.session import get_db
from app.models.user import User
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
)
from app.services.totp import generate_secret, get_provisioning_uri, verify_code
from app.api.v1.endpoints.auth import TokenResponse

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────

class MfaVerifyRequest(BaseModel):
    session_token: str
    code: str
    remember_me: bool = False


class MfaCodeRequest(BaseModel):
    code: str


class MfaSetupOut(BaseModel):
    secret: str
    uri: str


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _get_user_by_id(db: AsyncSession, user_id: str) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Utente non trovato")
    return user


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/verify", response_model=TokenResponse)
async def verify(body: MfaVerifyRequest, db: AsyncSession = Depends(get_db)):
    """Step 2 del login: verifica il codice TOTP e restituisce i token definitivi."""
    payload = decode_token(body.session_token)
    if payload.get("type") != "mfa_session" or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Session token non valido")

    user = await _get_user_by_id(db, payload["sub"])

    if not user.totp_enabled or not user.totp_secret:
        raise HTTPException(status_code=400, detail="MFA non attivo su questo account")

    if not verify_code(user.totp_secret, body.code):
        raise HTTPException(status_code=401, detail="Codice non valido")

    return TokenResponse(
        access_token=create_access_token(str(user.id), remember_me=body.remember_me),
        refresh_token=create_refresh_token(str(user.id), remember_me=body.remember_me),
    )


@router.post("/setup", response_model=MfaSetupOut)
async def setup(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Genera un nuovo secret TOTP e lo salva (totp_enabled rimane False).
    Il frontend mostra il QR all'utente; poi chiama /enable con il primo codice."""
    secret = generate_secret()
    current_user.totp_secret = secret
    await db.commit()
    return MfaSetupOut(
        secret=secret,
        uri=get_provisioning_uri(secret, current_user.email),
    )


@router.post("/enable")
async def enable(
    body: MfaCodeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Attiva il 2FA dopo che l'utente ha scansionato il QR e inserito il primo codice."""
    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="Esegui prima /auth/mfa/setup")
    if not verify_code(current_user.totp_secret, body.code):
        raise HTTPException(status_code=401, detail="Codice non valido")
    current_user.totp_enabled = True
    await db.commit()
    return {"detail": "MFA attivato"}


@router.post("/disable")
async def disable(
    body: MfaCodeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Disattiva il 2FA dopo verifica del codice corrente."""
    if not current_user.totp_enabled or not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="MFA non attivo")
    if not verify_code(current_user.totp_secret, body.code):
        raise HTTPException(status_code=401, detail="Codice non valido")
    current_user.totp_enabled = False
    current_user.totp_secret = None
    await db.commit()
    return {"detail": "MFA disattivato"}
