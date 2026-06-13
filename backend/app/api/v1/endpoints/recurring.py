from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.recurring_transaction import RecurringTransaction
from app.models.user import User
from app.services.recurring import next_raw_date, INTERVALS
from app.services.holidays import next_business_day
from typing import List, Literal, Optional

router = APIRouter()


class RecurringCreate(BaseModel):
    account_id: str
    category_id: Optional[str] = None
    amount: float
    type: Literal["expense", "income"]
    description: Optional[str] = None
    frequency: Literal["weekly", "monthly", "bimonthly", "quarterly"]
    start_date: date
    end_date: Optional[date] = None


class RecurringUpdate(BaseModel):
    account_id: Optional[str] = None
    category_id: Optional[str] = None
    amount: Optional[float] = None
    description: Optional[str] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None


class RecurringOut(BaseModel):
    id: str
    account_id: str
    category_id: Optional[str]
    amount: float
    type: str
    description: Optional[str]
    frequency: str
    start_date: date
    end_date: Optional[date]
    is_active: bool
    next_occurrence: Optional[date]


def _out(rt: RecurringTransaction) -> RecurringOut:
    raw = next_raw_date(rt) if rt.is_active else None
    return RecurringOut(
        id=str(rt.id),
        account_id=str(rt.account_id),
        category_id=str(rt.category_id) if rt.category_id else None,
        amount=float(rt.amount),
        type=rt.type,
        description=rt.description,
        frequency=rt.frequency,
        start_date=rt.start_date,
        end_date=rt.end_date,
        is_active=rt.is_active,
        next_occurrence=next_business_day(raw) if raw else None,
    )


async def _get_recurring(db: AsyncSession, recurring_id: str, user_id) -> RecurringTransaction:
    result = await db.execute(
        select(RecurringTransaction).where(
            RecurringTransaction.id == recurring_id, RecurringTransaction.user_id == user_id
        )
    )
    rt = result.scalar_one_or_none()
    if not rt:
        raise HTTPException(status_code=404, detail="Ricorrenza non trovata")
    return rt


@router.get("/", response_model=List[RecurringOut])
async def list_recurring(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(RecurringTransaction)
        .where(RecurringTransaction.user_id == user.id)
        .order_by(RecurringTransaction.created_at)
    )
    return [_out(rt) for rt in result.scalars()]


@router.post("/", response_model=RecurringOut, status_code=201)
async def create_recurring(
    data: RecurringCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    if data.frequency not in INTERVALS:
        raise HTTPException(status_code=400, detail="Frequenza non valida")
    rt = RecurringTransaction(**data.model_dump(), user_id=user.id)
    db.add(rt)
    await db.commit()
    await db.refresh(rt)
    return _out(rt)


@router.patch("/{recurring_id}", response_model=RecurringOut)
async def update_recurring(
    recurring_id: str,
    data: RecurringUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rt = await _get_recurring(db, recurring_id, user.id)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(rt, field, value)
    await db.commit()
    await db.refresh(rt)
    return _out(rt)


@router.delete("/{recurring_id}", status_code=204)
async def delete_recurring(
    recurring_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    rt = await _get_recurring(db, recurring_id, user.id)
    await db.delete(rt)
    await db.commit()
