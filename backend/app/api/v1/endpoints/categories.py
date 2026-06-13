from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.category import Category
from app.models.user import User
from app.core.security import get_current_user
from pydantic import BaseModel
from typing import List, Literal, Optional

router = APIRouter()


class CategoryCreate(BaseModel):
    name: str
    icon: str = "📦"
    color: str = "#6366f1"
    type: Literal["expense", "income"]


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class CategoryOut(BaseModel):
    id: str
    name: str
    icon: str
    color: str
    type: str
    is_default: bool


DEFAULT_CATEGORIES = [
    ("🛒", "Spesa & Alimentari",            "#22c55e", "expense"),
    ("🍕", "Ristoranti & Bar",               "#ef4444", "expense"),
    ("🚗", "Trasporti",                      "#f97316", "expense"),
    ("🏠", "Casa",                           "#eab308", "expense"),
    ("💡", "Bollette & Utenze",              "#fbbf24", "expense"),
    ("✈️", "Viaggi & Vacanze",               "#0ea5e9", "expense"),
    ("🛍️", "Shopping",                       "#ec4899", "expense"),
    ("📖", "Istruzione",                     "#a78bfa", "expense"),
    ("📱", "Abbonamenti",                    "#06b6d4", "expense"),
    ("🛡️", "Assicurazioni",                  "#64748b", "expense"),
    ("🏥", "Salute",                         "#10b981", "expense"),
    ("🎭", "Intrattenimento & Tempo libero", "#8b5cf6", "expense"),
    ("🐾", "Animali",                        "#84cc16", "expense"),
    ("💰", "Risparmi & Investimenti",        "#14b8a6", "expense"),
    ("🔄", "Trasferimento",                  "#94a3b8", "expense"),
    ("📦", "Varie",                          "#71717a", "expense"),
    ("💼", "Stipendio",                      "#22c55e", "income"),
    ("💸", "Rimborsi",                       "#10b981", "income"),
    ("📈", "Investimenti",                   "#f59e0b", "income"),
    ("🎁", "Regali ricevuti",                "#f472b6", "income"),
    ("💰", "Altre entrate",                  "#6366f1", "income"),
]


def _out(c: Category) -> CategoryOut:
    return CategoryOut(id=str(c.id), name=c.name, icon=c.icon,
                       color=c.color, type=c.type, is_default=c.is_default)


async def _get_category(db: AsyncSession, category_id: str, user_id) -> Category:
    result = await db.execute(
        select(Category).where(Category.id == category_id, Category.user_id == user_id)
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria non trovata")
    return cat


@router.get("/", response_model=List[CategoryOut])
async def list_categories(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Category)
        .where(Category.user_id == user.id, Category.is_active == True)
        .order_by(Category.created_at)
    )
    cats = result.scalars().all()
    if not cats:
        defaults = [
            Category(user_id=user.id, icon=i, name=n, color=c, type=t, is_default=True)
            for i, n, c, t in DEFAULT_CATEGORIES
        ]
        db.add_all(defaults)
        await db.commit()
        return [_out(c) for c in defaults]
    return [_out(c) for c in cats]


@router.post("/", response_model=CategoryOut, status_code=201)
async def create_category(data: CategoryCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    cat = Category(**data.model_dump(), user_id=user.id)
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return _out(cat)


@router.patch("/{category_id}", response_model=CategoryOut)
async def update_category(
    category_id: str,
    data: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cat = await _get_category(db, category_id, user.id)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(cat, field, value)
    await db.commit()
    await db.refresh(cat)
    return _out(cat)


@router.delete("/{category_id}", status_code=204)
async def delete_category(
    category_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cat = await _get_category(db, category_id, user.id)
    if cat.is_default:
        raise HTTPException(status_code=400, detail="Le categorie predefinite non possono essere eliminate")
    cat.is_active = False
    await db.commit()
