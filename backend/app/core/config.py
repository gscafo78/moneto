from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    APP_ENV: str = "development"   # "production" in prod
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

    class Config:
        env_file = ".env"


settings = Settings()
