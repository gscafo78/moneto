from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.category import Category
from app.models.user import User
from app.core.security import get_current_user
from pydantic import BaseModel
from typing import List, Literal

router = APIRouter()

class CategoryCreate(BaseModel):
    name: str
    icon: str = "📦"
    color: str = "#6366f1"
    type: Literal["expense", "income"]

class CategoryOut(CategoryCreate):
    id: str
    is_default: bool = False

DEFAULT_CATEGORIES = [
    ("🍕", "Cibo & Ristoranti", "#ef4444", "expense"),
    ("🚗", "Trasporti", "#f97316", "expense"),
    ("🏠", "Casa", "#eab308", "expense"),
    ("💊", "Salute", "#22c55e", "expense"),
    ("🎭", "Intrattenimento", "#8b5cf6", "expense"),
    ("👕", "Abbigliamento", "#ec4899", "expense"),
    ("📱", "Tecnologia", "#06b6d4", "expense"),
    ("💼", "Stipendio", "#22c55e", "income"),
    ("💰", "Entrate extra", "#10b981", "income"),
]

@router.get("/", response_model=List[CategoryOut])
async def list_categories(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(Category).where(Category.user_id == user.id, Category.is_active == True))
    cats = result.scalars().all()
    if not cats:
        # Seed categorie di default
        defaults = [Category(user_id=user.id, icon=i, name=n, color=c, type=t, is_default=True) for i,n,c,t in DEFAULT_CATEGORIES]
        db.add_all(defaults)
        await db.commit()
        return [CategoryOut(id=str(c.id), name=c.name, icon=c.icon, color=c.color, type=c.type, is_default=True) for c in defaults]
    return [CategoryOut(id=str(c.id), name=c.name, icon=c.icon, color=c.color, type=c.type, is_default=c.is_default) for c in cats]

@router.post("/", response_model=CategoryOut, status_code=201)
async def create_category(data: CategoryCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    cat = Category(**data.model_dump(), user_id=user.id)
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return CategoryOut(id=str(cat.id), **data.model_dump())
