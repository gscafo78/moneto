from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.transaction import Transaction
from app.models.category import Category
from app.models.account import Account
from app.models.recurring_transaction import RecurringTransaction
from app.models.user import User
from app.core.security import get_current_user
from app.services.balance import compute_balances
from app.services.recurring import projected_occurrences_in_range
from typing import List, Optional
from pydantic import BaseModel
from datetime import date, datetime, time, timedelta, timezone
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


class PendingItem(BaseModel):
    id: str
    date: datetime
    amount: float
    category_id: Optional[str]
    account_id: str
    note: Optional[str]
    is_recurring: bool


class SummaryResponse(BaseModel):
    income: float
    expenses: float
    pending_expenses: float
    balance: float
    by_category: List[CategoryStat]
    pending_items: List[PendingItem]


class MonthTrend(BaseModel):
    year: int
    month: int
    income: float
    expenses: float


@router.get("/summary", response_model=SummaryResponse)
async def summary(
    start: date = Query(...),
    end: date = Query(...),
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

    account_filters = [Account.user_id == user.id, Account.is_active == True]
    if account_uuid:
        account_filters.append(Account.id == account_uuid)
    accounts_result = await db.execute(select(Account).where(*account_filters))
    accounts = list(accounts_result.scalars())
    if account_uuid and not accounts:
        raise HTTPException(status_code=404, detail="Conto non trovato")
    account_ids = [a.id for a in accounts]

    now = datetime.now(timezone.utc)
    start_dt = datetime.combine(start, time.min)
    end_dt = datetime.combine(end + timedelta(days=1), time.min)

    tx_filters = [
        Transaction.user_id == user.id,
        Transaction.account_id.in_(account_ids),
        Transaction.date >= start_dt,
        Transaction.date < end_dt,
    ]
    result = await db.execute(select(Transaction).where(*tx_filters))
    txs = result.scalars().all()

    balances = await compute_balances(db, account_ids, as_of=now)
    balance = sum(float(b) for b in balances.values())

    income = sum(float(t.amount) for t in txs if t.type == "income" and t.date <= now)
    expenses = sum(float(t.amount) for t in txs if t.type == "expense" and t.date <= now)
    pending_expenses = sum(float(t.amount) for t in txs if t.type == "expense" and t.date > now)

    pending_items: List[PendingItem] = [
        PendingItem(
            id=str(t.id), date=t.date, amount=float(t.amount),
            category_id=str(t.category_id) if t.category_id else None,
            account_id=str(t.account_id), note=t.note, is_recurring=False,
        )
        for t in txs if t.type == "expense" and t.date > now
    ]

    # Spese senza categoria vengono raggruppate sotto "Varie"
    varie_result = await db.execute(
        select(Category.id).where(
            Category.user_id == user.id, Category.name == "Varie", Category.type == "expense"
        )
    )
    varie_id = varie_result.scalar_one_or_none()

    def expense_key(category_id: Optional[uuid.UUID]) -> Optional[str]:
        if category_id:
            return str(category_id)
        return str(varie_id) if varie_id else None

    cat_totals: dict[str, float] = {}
    for t in txs:
        if t.type == "expense" and t.date <= now:
            key = expense_key(t.category_id)
            if key:
                cat_totals[key] = cat_totals.get(key, 0) + float(t.amount)

    # Occorrenze di ricorrenze previste nel periodo ma non ancora generate
    today = date.today()
    recurring_filters = [
        RecurringTransaction.user_id == user.id,
        RecurringTransaction.is_active == True,
    ]
    if account_uuid:
        recurring_filters.append(RecurringTransaction.account_id == account_uuid)
    else:
        recurring_filters.append(RecurringTransaction.account_id.in_(account_ids))

    recurring_result = await db.execute(select(RecurringTransaction).where(*recurring_filters))
    for rt in recurring_result.scalars():
        occurrences = projected_occurrences_in_range(rt, start, end, today)
        if not occurrences:
            continue
        total_amount = float(rt.amount) * len(occurrences)
        if rt.type == "expense":
            pending_expenses += total_amount
            for occ in occurrences:
                pending_items.append(PendingItem(
                    id=f"recurring-{rt.id}-{occ.isoformat()}",
                    date=datetime(occ.year, occ.month, occ.day, 9, 0, 0, tzinfo=timezone.utc),
                    amount=float(rt.amount),
                    category_id=str(rt.category_id) if rt.category_id else None,
                    account_id=str(rt.account_id),
                    note=rt.description,
                    is_recurring=True,
                ))

    pending_items.sort(key=lambda x: x.date)

    by_category: List[CategoryStat] = []
    if cat_totals:
        cat_ids = [uuid.UUID(k) for k in cat_totals]
        cat_result = await db.execute(select(Category).where(Category.id.in_(cat_ids)))
        cats = {str(c.id): c for c in cat_result.scalars()}
        for cat_id, total in cat_totals.items():
            if cat := cats.get(cat_id):
                by_category.append(
                    CategoryStat(category_id=cat_id, name=cat.name,
                                 icon=cat.icon, color=cat.color, total=total)
                )
        by_category.sort(key=lambda x: x.total, reverse=True)

    return SummaryResponse(
        income=income, expenses=expenses,
        pending_expenses=pending_expenses,
        balance=balance,
        by_category=by_category,
        pending_items=pending_items,
    )


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
