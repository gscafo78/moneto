from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.transaction import Transaction
from app.models.account import Account
from app.models.user import User
from app.api.v1.endpoints.auth import get_current_user
from pydantic import BaseModel
from typing import List, Literal, Optional
from datetime import datetime

router = APIRouter()

class TransactionCreate(BaseModel):
    account_id: str
    category_id: Optional[str] = None
    amount: float
    type: Literal["expense", "income", "transfer"]
    note: Optional[str] = None
    date: Optional[datetime] = None

class TransactionOut(TransactionCreate):
    id: str
    date: datetime

@router.get("/", response_model=List[TransactionOut])
async def list_transactions(
    year: int = Query(default=None),
    month: int = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    q = select(Transaction).where(Transaction.user_id == user.id)
    if year and month:
        from sqlalchemy import extract
        q = q.where(extract("year", Transaction.date) == year).where(extract("month", Transaction.date) == month)
    q = q.order_by(Transaction.date.desc())
    result = await db.execute(q)
    return [TransactionOut(id=str(t.id), account_id=str(t.account_id), category_id=str(t.category_id) if t.category_id else None, amount=float(t.amount), type=t.type, note=t.note, date=t.date) for t in result.scalars()]

@router.post("/", response_model=TransactionOut, status_code=201)
async def create_transaction(data: TransactionCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    tx = Transaction(**data.model_dump(), user_id=user.id, date=data.date or datetime.utcnow())
    db.add(tx)
    # Aggiorna saldo conto
    acc_result = await db.execute(select(Account).where(Account.id == data.account_id))
    account = acc_result.scalar_one_or_none()
    if account:
        if data.type == "income":
            account.balance += data.amount
        elif data.type == "expense":
            account.balance -= data.amount
    await db.commit()
    await db.refresh(tx)
    return TransactionOut(id=str(tx.id), **data.model_dump(), date=tx.date)

@router.delete("/{tx_id}", status_code=204)
async def delete_transaction(tx_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    from fastapi import HTTPException
    result = await db.execute(select(Transaction).where(Transaction.id == tx_id, Transaction.user_id == user.id))
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404)
    # Inverti saldo
    acc_result = await db.execute(select(Account).where(Account.id == tx.account_id))
    account = acc_result.scalar_one_or_none()
    if account:
        if tx.type == "income":
            account.balance -= tx.amount
        elif tx.type == "expense":
            account.balance += tx.amount
    await db.delete(tx)
    await db.commit()
