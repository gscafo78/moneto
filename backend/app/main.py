from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1 import router as api_router

# Docs esposti solo in development
_docs  = None if settings.APP_ENV == "production" else "/api/docs"
_redoc = None if settings.APP_ENV == "production" else "/api/redoc"

app = FastAPI(
    title="Moneto",
    version="0.1.0",
    docs_url=_docs,
    redoc_url=_redoc,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}
