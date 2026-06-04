from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract
from app.db.session import get_db
from app.models.transaction import Transaction
from app.models.category import Category
from app.models.user import User
from app.api.v1.endpoints.auth import get_current_user
from typing import List
from pydantic import BaseModel

router = APIRouter()

class CategoryStat(BaseModel):
    category_id: str
    name: str
    icon: str
    color: str
    total: float

class MonthlySummary(BaseModel):
    income: float
    expenses: float
    balance: float
    by_category: List[CategoryStat]

@router.get("/monthly", response_model=MonthlySummary)
async def monthly_stats(
    year: int = Query(...),
    month: int = Query(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    q = select(Transaction).where(
        Transaction.user_id == user.id,
        extract("year", Transaction.date) == year,
        extract("month", Transaction.date) == month,
    )
    result = await db.execute(q)
    txs = result.scalars().all()

    income = sum(float(t.amount) for t in txs if t.type == "income")
    expenses = sum(float(t.amount) for t in txs if t.type == "expense")

    # Raggruppa per categoria
    cat_totals: dict = {}
    for t in txs:
        if t.type == "expense" and t.category_id:
            key = str(t.category_id)
            cat_totals[key] = cat_totals.get(key, 0) + float(t.amount)

    by_category = []
    for cat_id, total in cat_totals.items():
        cat_result = await db.execute(select(Category).where(Category.id == cat_id))
        cat = cat_result.scalar_one_or_none()
        if cat:
            by_category.append(CategoryStat(category_id=cat_id, name=cat.name, icon=cat.icon, color=cat.color, total=total))

    by_category.sort(key=lambda x: x.total, reverse=True)
    return MonthlySummary(income=income, expenses=expenses, balance=income - expenses, by_category=by_category)
