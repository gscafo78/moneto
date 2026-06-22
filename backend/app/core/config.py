import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import List

# Priorità: variabile d'ambiente APP_VERSION (impostata via docker-compose) →
# file VERSION nella root del repo (funziona in locale / dev senza Docker) → fallback
_VERSION_FILE = Path(__file__).parents[3] / "VERSION"
APP_VERSION: str = (
    os.environ.get("APP_VERSION")
    or (_VERSION_FILE.read_text().strip() if _VERSION_FILE.exists() else None)
    or "0.0.0"
)


class Settings(BaseSettings):
    APP_ENV: str = "development"   # "production" in prod
    # Se False (default), la registrazione è aperta solo al primo utente.
    # Impostare ALLOW_REGISTRATION=true nel .env per ri-abilitarla.
    ALLOW_REGISTRATION: bool = False
    SECRET_KEY: str = "dev-secret-change-in-prod"
    ALGORITHM: str = "HS256"

    # Access token: breve durata, rinnovato dal refresh
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Refresh token senza "Ricordami"
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Refresh token con "Ricordami" (configurabile via env REMEMBER_ME_EXPIRE_DAYS)
    REMEMBER_ME_EXPIRE_DAYS: int = 30

    DATABASE_URL: str = "postgresql+asyncpg://budget:budget_secret@db:5432/budgetdb"
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # URL del frontend, usato per costruire i link nelle email (verifica, reset, ecc.)
    FRONTEND_URL: str = "http://localhost:5173"

    # SMTP per invio email (se SMTP_HOST è vuoto, le email vengono solo loggate)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "Moneto <no-reply@moneto.app>"
    SMTP_TLS: bool = True

    class Config:
        env_file = ".env"


settings = Settings()
