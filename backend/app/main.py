from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import router as api_router
from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.services.recurring import process_due_recurring


async def _run_recurring_job() -> None:
    async with AsyncSessionLocal() as db:
        await process_due_recurring(db)


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = AsyncIOScheduler()
    scheduler.add_job(_run_recurring_job, "cron", hour=0, minute=10, id="process_due_recurring")
    scheduler.start()
    yield
    scheduler.shutdown()


# Docs esposti solo in development
_docs  = None if settings.APP_ENV == "production" else "/api/docs"
_redoc = None if settings.APP_ENV == "production" else "/api/redoc"

app = FastAPI(
    title="Moneto",
    version="0.1.0",
    docs_url=_docs,
    redoc_url=_redoc,
    lifespan=lifespan,
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
