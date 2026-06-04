from fastapi import APIRouter
from app.api.v1.endpoints import auth, mfa, accounts, categories, transactions, stats

router = APIRouter()
router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(mfa.router, prefix="/auth/mfa", tags=["mfa"])
router.include_router(accounts.router, prefix="/accounts", tags=["accounts"])
router.include_router(categories.router, prefix="/categories", tags=["categories"])
router.include_router(transactions.router, prefix="/transactions", tags=["transactions"])
router.include_router(stats.router, prefix="/stats", tags=["stats"])
