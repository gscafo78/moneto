from datetime import date, datetime, time, timedelta
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import extract, select
from sqlalchemy.ext.asyncio import AsyncSession

from decimal import Decimal

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.user import User

router = APIRouter()


class TransactionCreate(BaseModel):
    account_id: str
    category_id: Optional[str] = None
    amount: float
    type: Literal["expense", "income", "transfer"]
    note: Optional[str] = None
    date: Optional[datetime] = None
    voucher_quantity: Optional[int] = None


class TransactionUpdate(BaseModel):
    account_id: Optional[str] = None
    category_id: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[Literal["expense", "income", "transfer"]] = None
    note: Optional[str] = None
    date: Optional[datetime] = None
    voucher_quantity: Optional[int] = None


class TransactionOut(BaseModel):
    id: str
    account_id: str
    category_id: Optional[str]
    amount: float
    type: str
    note: Optional[str]
    date: datetime
    voucher_quantity: Optional[int] = None


def _out(t: Transaction) -> TransactionOut:
    return TransactionOut(
        id=str(t.id),
        account_id=str(t.account_id),
        category_id=str(t.category_id) if t.category_id else None,
        amount=float(t.amount),
        type=t.type,
        note=t.note,
        date=t.date,
        voucher_quantity=t.voucher_quantity,
    )


async def _get_account_for_user(db: AsyncSession, account_id: str, user_id) -> Optional[Account]:
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == user_id)
    )
    return result.scalar_one_or_none()


@router.get("/", response_model=List[TransactionOut])
async def list_transactions(
    year: int = Query(default=None),
    month: int = Query(default=None),
    start: date = Query(default=None),
    end: date = Query(default=None),
    account_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(Transaction).where(Transaction.user_id == user.id)
    if start and end:
        q = q.where(
            Transaction.date >= datetime.combine(start, time.min),
            Transaction.date < datetime.combine(end + timedelta(days=1), time.min),
        )
    elif year and month:
        q = q.where(
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == month,
        )
    if account_id:
        q = q.where(Transaction.account_id == account_id)
    q = q.order_by(Transaction.date.desc())
    result = await db.execute(q)
    return [_out(t) for t in result.scalars()]


@router.post("/", response_model=TransactionOut, status_code=201)
async def create_transaction(
    data: TransactionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tx_date = data.date or datetime.utcnow()
    amount = data.amount
    if data.voucher_quantity is not None:
        account = await _get_account_for_user(db, data.account_id, user.id)
        if account and account.meal_voucher_value is not None:
            amount = float(Decimal(data.voucher_quantity) * account.meal_voucher_value)

    tx = Transaction(
        user_id=user.id,
        account_id=data.account_id,
        category_id=data.category_id,
        amount=amount,
        type=data.type,
        note=data.note,
        date=tx_date,
        voucher_quantity=data.voucher_quantity,
    )
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    return _out(tx)


@router.patch("/{tx_id}", response_model=TransactionOut)
async def update_transaction(
    tx_id: str,
    data: TransactionUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Transaction).where(Transaction.id == tx_id, Transaction.user_id == user.id)
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Transazione non trovata")

    update_data = data.model_dump(exclude_unset=True)

    if "voucher_quantity" in update_data and update_data["voucher_quantity"] is not None:
        account_id = update_data.get("account_id", str(tx.account_id))
        account = await _get_account_for_user(db, account_id, user.id)
        if account and account.meal_voucher_value is not None:
            update_data["amount"] = float(Decimal(update_data["voucher_quantity"]) * account.meal_voucher_value)

    for field, value in update_data.items():
        setattr(tx, field, value)

    await db.commit()
    await db.refresh(tx)
    return _out(tx)


@router.delete("/{tx_id}", status_code=204)
async def delete_transaction(
    tx_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Transaction).where(Transaction.id == tx_id, Transaction.user_id == user.id)
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Transazione non trovata")

    await db.delete(tx)
    await db.commit()
