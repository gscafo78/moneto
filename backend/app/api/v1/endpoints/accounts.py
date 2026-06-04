from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.account import Account
from app.models.user import User
from app.core.security import get_current_user
from pydantic import BaseModel
from typing import List
import uuid

router = APIRouter()

class AccountCreate(BaseModel):
    name: str
    icon: str = "💳"
    color: str = "#6366f1"
    balance: float = 0
    currency: str = "EUR"

class AccountOut(AccountCreate):
    id: str

@router.get("/", response_model=List[AccountOut])
async def list_accounts(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(Account).where(Account.user_id == user.id, Account.is_active == True))
    return [AccountOut(id=str(a.id), name=a.name, icon=a.icon, color=a.color, balance=float(a.balance), currency=a.currency) for a in result.scalars()]

@router.post("/", response_model=AccountOut, status_code=201)
async def create_account(data: AccountCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    account = Account(**data.model_dump(), user_id=user.id)
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return AccountOut(id=str(account.id), **data.model_dump())

@router.delete("/{account_id}", status_code=204)
async def delete_account(account_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(Account).where(Account.id == account_id, Account.user_id == user.id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Conto non trovato")
    account.is_active = False
    await db.commit()
