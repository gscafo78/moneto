from decimal import Decimal
from datetime import datetime
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import extract, select
from sqlalchemy.ext.asyncio import AsyncSession

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


class TransactionOut(BaseModel):
    id: str
    account_id: str
    category_id: Optional[str]
    amount: float
    type: str
    note: Optional[str]
    date: datetime


def _out(t: Transaction) -> TransactionOut:
    return TransactionOut(
        id=str(t.id),
        account_id=str(t.account_id),
        category_id=str(t.category_id) if t.category_id else None,
        amount=float(t.amount),
        type=t.type,
        note=t.note,
        date=t.date,
    )


@router.get("/", response_model=List[TransactionOut])
async def list_transactions(
    year: int = Query(default=None),
    month: int = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(Transaction).where(Transaction.user_id == user.id)
    if year and month:
        q = q.where(
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == month,
        )
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
    tx = Transaction(
        user_id=user.id,
        account_id=data.account_id,
        category_id=data.category_id,
        amount=data.amount,
        type=data.type,
        note=data.note,
        date=tx_date,
    )
    db.add(tx)

    # Aggiorna saldo conto
    acc_q = await db.execute(select(Account).where(Account.id == data.account_id))
    account = acc_q.scalar_one_or_none()
    if account:
        amt = Decimal(str(data.amount))
        if data.type == "income":
            account.balance += amt
        elif data.type == "expense":
            account.balance -= amt

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

    acc_q = await db.execute(select(Account).where(Account.id == tx.account_id))
    account = acc_q.scalar_one_or_none()
    if account:
        if tx.type == "income":
            account.balance -= tx.amount
        elif tx.type == "expense":
            account.balance += tx.amount

    await db.delete(tx)
    await db.commit()
