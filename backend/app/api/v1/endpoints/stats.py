from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, extract
from app.db.session import get_db
from app.models.transaction import Transaction
from app.models.category import Category
from app.models.user import User
from app.core.security import get_current_user
from typing import List
from pydantic import BaseModel
from datetime import date
from dateutil.relativedelta import relativedelta

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


class MonthTrend(BaseModel):
    year: int
    month: int
    income: float
    expenses: float


@router.get("/monthly", response_model=MonthlySummary)
async def monthly_stats(
    year: int = Query(...),
    month: int = Query(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Transaction).where(
            Transaction.user_id == user.id,
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == month,
        )
    )
    txs = result.scalars().all()

    income   = sum(float(t.amount) for t in txs if t.type == "income")
    expenses = sum(float(t.amount) for t in txs if t.type == "expense")

    # Aggrega per categoria in un unico fetch
    cat_totals: dict[str, float] = {}
    for t in txs:
        if t.type == "expense" and t.category_id:
            key = str(t.category_id)
            cat_totals[key] = cat_totals.get(key, 0) + float(t.amount)

    by_category: List[CategoryStat] = []
    if cat_totals:
        from sqlalchemy.dialects.postgresql import UUID as PG_UUID
        import uuid
        cat_ids = [uuid.UUID(k) for k in cat_totals]
        cat_result = await db.execute(
            select(Category).where(Category.id.in_(cat_ids))
        )
        cats = {str(c.id): c for c in cat_result.scalars()}
        for cat_id, total in cat_totals.items():
            if cat := cats.get(cat_id):
                by_category.append(
                    CategoryStat(category_id=cat_id, name=cat.name,
                                 icon=cat.icon, color=cat.color, total=total)
                )
        by_category.sort(key=lambda x: x.total, reverse=True)

    return MonthlySummary(income=income, expenses=expenses,
                          balance=income - expenses, by_category=by_category)


@router.get("/trend", response_model=List[MonthTrend])
async def trend(
    months: int = Query(default=6, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Ultimi N mesi (incluso quello corrente) in ordine cronologico."""
    today = date.today()
    # Genera i mesi da (oggi - N+1 mesi) a oggi
    periods = [
        (today - relativedelta(months=i)).replace(day=1)
        for i in range(months - 1, -1, -1)
    ]

    result = await db.execute(
        select(Transaction).where(
            Transaction.user_id == user.id,
            Transaction.type.in_(["income", "expense"]),
            Transaction.date >= periods[0],
        )
    )
    txs = result.scalars().all()

    # Aggrega in memoria per anno/mese
    agg: dict[tuple[int, int], dict[str, float]] = {
        (p.year, p.month): {"income": 0.0, "expenses": 0.0} for p in periods
    }
    for t in txs:
        key = (t.date.year, t.date.month)
        if key in agg:
            if t.type == "income":
                agg[key]["income"] += float(t.amount)
            elif t.type == "expense":
                agg[key]["expenses"] += float(t.amount)

    return [
        MonthTrend(year=p.year, month=p.month,
                   income=agg[(p.year, p.month)]["income"],
                   expenses=agg[(p.year, p.month)]["expenses"])
        for p in periods
    ]
