from decimal import Decimal
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.user import User
from app.core.security import get_current_user
from app.services.balance import compute_balance, compute_balances
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()


class AccountCreate(BaseModel):
    name: str
    icon: str = "💳"
    color: str = "#6366f1"
    opening_balance: float = 0
    currency: str = "EUR"
    meal_voucher_value: Optional[float] = None


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    meal_voucher_value: Optional[float] = None


class AccountOut(BaseModel):
    id: str
    name: str
    icon: str
    color: str
    balance: float
    currency: str
    meal_voucher_value: Optional[float] = None


def _out(a: Account, current_balance: Decimal) -> AccountOut:
    return AccountOut(id=str(a.id), name=a.name, icon=a.icon,
                      color=a.color, balance=float(current_balance), currency=a.currency,
                      meal_voucher_value=float(a.meal_voucher_value) if a.meal_voucher_value is not None else None)


async def _get_account(db: AsyncSession, account_id: str, user_id) -> Account:
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == user_id, Account.is_active == True)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Conto non trovato")
    return account


@router.get("/", response_model=List[AccountOut])
async def list_accounts(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Account).where(Account.user_id == user.id, Account.is_active == True).order_by(Account.created_at)
    )
    accounts = list(result.scalars())
    balances = await compute_balances(db, [a.id for a in accounts])
    return [_out(a, balances.get(a.id, Decimal("0"))) for a in accounts]


@router.post("/", response_model=AccountOut, status_code=201)
async def create_account(data: AccountCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    account = Account(**data.model_dump(), user_id=user.id)
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return _out(account, account.opening_balance)


@router.patch("/{account_id}", response_model=AccountOut)
async def update_account(
    account_id: str,
    data: AccountUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    account = await _get_account(db, account_id, user.id)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(account, field, value)
    await db.commit()
    await db.refresh(account)
    balance = await compute_balance(db, account.id)
    return _out(account, balance)


@router.delete("/{account_id}", status_code=204)
async def delete_account(account_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    account = await _get_account(db, account_id, user.id)
    account.is_active = False
    await db.commit()


class ReconcileRequest(BaseModel):
    real_balance: float


class TransactionOut(BaseModel):
    id: str
    account_id: str
    category_id: Optional[str]
    amount: float
    type: str
    note: Optional[str]
    date: datetime


class ReconcileResponse(BaseModel):
    account: AccountOut
    transaction: Optional[TransactionOut]
    difference: float


def _tx_out(t: Transaction) -> TransactionOut:
    return TransactionOut(
        id=str(t.id),
        account_id=str(t.account_id),
        category_id=str(t.category_id) if t.category_id else None,
        amount=float(t.amount),
        type=t.type,
        note=t.note,
        date=t.date,
    )


@router.post("/{account_id}/reconcile", response_model=ReconcileResponse)
async def reconcile_account(
    account_id: str,
    data: ReconcileRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    account = await _get_account(db, account_id, user.id)

    real_balance = Decimal(str(data.real_balance))
    current_balance = await compute_balance(db, account.id)
    diff = real_balance - current_balance

    if diff == 0:
        return ReconcileResponse(account=_out(account, current_balance), transaction=None, difference=0)

    tx = Transaction(
        user_id=user.id,
        account_id=account.id,
        category_id=None,
        amount=abs(diff),
        type="income" if diff > 0 else "expense",
        note="Rettifica saldo (riconciliazione)",
        date=datetime.utcnow(),
        is_reconciliation=True,
    )
    db.add(tx)

    await db.commit()
    await db.refresh(account)
    await db.refresh(tx)

    new_balance = await compute_balance(db, account.id)
    return ReconcileResponse(account=_out(account, new_balance), transaction=_tx_out(tx), difference=float(diff))
