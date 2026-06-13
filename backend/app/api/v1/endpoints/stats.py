from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, extract
from app.db.session import get_db
from app.models.transaction import Transaction
from app.models.category import Category
from app.models.account import Account
from app.models.recurring_transaction import RecurringTransaction
from app.models.user import User
from app.core.security import get_current_user
from app.services.recurring import projected_occurrences
from typing import List, Optional
from pydantic import BaseModel
from datetime import date
from dateutil.relativedelta import relativedelta
from fastapi import HTTPException
import uuid

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
    real_balance: float
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
    account_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    account_uuid: Optional[uuid.UUID] = None
    if account_id:
        try:
            account_uuid = uuid.UUID(account_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="account_id non valido")

    tx_filters = [
        Transaction.user_id == user.id,
        extract("year", Transaction.date) == year,
        extract("month", Transaction.date) == month,
    ]
    if account_uuid:
        tx_filters.append(Transaction.account_id == account_uuid)

    result = await db.execute(select(Transaction).where(*tx_filters))
    txs = result.scalars().all()

    income   = sum(float(t.amount) for t in txs if t.type == "income")
    expenses = sum(float(t.amount) for t in txs if t.type == "expense")

    # Aggrega per categoria in un unico fetch
    cat_totals: dict[str, float] = {}
    for t in txs:
        if t.type == "expense" and t.category_id:
            key = str(t.category_id)
            cat_totals[key] = cat_totals.get(key, 0) + float(t.amount)

    # Occorrenze di ricorrenze previste per questo mese ma non ancora generate
    today = date.today()
    projected_expenses = 0.0
    projected_income = 0.0
    recurring_filters = [
        RecurringTransaction.user_id == user.id,
        RecurringTransaction.is_active == True,
    ]
    if account_uuid:
        recurring_filters.append(RecurringTransaction.account_id == account_uuid)

    recurring_result = await db.execute(
        select(RecurringTransaction).where(*recurring_filters)
    )
    for rt in recurring_result.scalars():
        occurrences = projected_occurrences(rt, year, month, today)
        if not occurrences:
            continue
        total_amount = float(rt.amount) * len(occurrences)
        if rt.type == "income":
            projected_income += total_amount
            income += total_amount
        else:
            projected_expenses += total_amount
            expenses += total_amount
            if rt.category_id:
                key = str(rt.category_id)
                cat_totals[key] = cat_totals.get(key, 0) + total_amount

    # Saldo reale: patrimonio attuale meno le spese ricorrenti previste non ancora
    # generate per il resto del mese, più le entrate ricorrenti previste
    if account_uuid:
        account_result = await db.execute(
            select(Account).where(Account.id == account_uuid, Account.user_id == user.id)
        )
        account = account_result.scalar_one_or_none()
        if account is None:
            raise HTTPException(status_code=404, detail="Conto non trovato")
        total_balance = float(account.balance)
    else:
        accounts_result = await db.execute(
            select(Account).where(Account.user_id == user.id, Account.is_active == True)
        )
        total_balance = sum(float(a.balance) for a in accounts_result.scalars())

    real_balance = total_balance - projected_expenses + projected_income

    by_category: List[CategoryStat] = []
    if cat_totals:
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
                          balance=income - expenses, real_balance=real_balance,
                          by_category=by_category)


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
