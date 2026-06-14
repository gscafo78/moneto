from datetime import date, datetime, time, timezone
from decimal import Decimal
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.accounts import _get_account
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.category import Category
from app.models.transaction import Transaction
from app.models.user import User
from app.services.csv_import import (
    compute_import_hash,
    decode_csv_bytes,
    parse_mediobanca_csv,
    suggest_category_name,
)

router = APIRouter()


class ImportRowPreview(BaseModel):
    date: date
    description: str
    amount: float
    type: Literal["income", "expense"]
    currency: str
    suggested_category_id: Optional[str]
    is_duplicate: bool
    currency_mismatch: bool
    hash: str


class ImportPreviewResponse(BaseModel):
    rows: List[ImportRowPreview]
    warnings: List[str]


class ImportRowConfirm(BaseModel):
    date: date
    description: str
    amount: float
    type: Literal["income", "expense"]
    category_id: Optional[str] = None
    hash: str


class ImportConfirmRequest(BaseModel):
    account_id: str
    rows: List[ImportRowConfirm]


class ImportConfirmResponse(BaseModel):
    imported: int
    skipped_duplicates: int


async def _existing_hashes(db: AsyncSession, account_id: str, hashes: list[str]) -> set[str]:
    if not hashes:
        return set()
    result = await db.execute(
        select(Transaction.import_hash).where(
            Transaction.account_id == account_id,
            Transaction.import_hash.in_(hashes),
        )
    )
    return {h for h in result.scalars() if h is not None}


@router.post("/mediobanca/preview", response_model=ImportPreviewResponse)
async def preview_mediobanca(
    account_id: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    account = await _get_account(db, account_id, user.id)

    raw = await file.read()
    text = decode_csv_bytes(raw)
    parsed_rows, warnings = parse_mediobanca_csv(text)

    hashes = [
        compute_import_hash(account_id, row.date, row.amount, row.description)
        for row in parsed_rows
    ]
    duplicate_hashes = await _existing_hashes(db, account_id, hashes)

    cat_result = await db.execute(
        select(Category).where(Category.user_id == user.id, Category.is_active == True)
    )
    categories_by_name = {c.name.lower(): c for c in cat_result.scalars()}

    rows: list[ImportRowPreview] = []
    for row, row_hash in zip(parsed_rows, hashes):
        suggested_name = suggest_category_name(row.description, row.type)
        suggested_category = categories_by_name.get(suggested_name.lower()) if suggested_name else None
        rows.append(ImportRowPreview(
            date=row.date,
            description=row.description,
            amount=float(row.amount),
            type=row.type,
            currency=row.currency,
            suggested_category_id=str(suggested_category.id) if suggested_category else None,
            is_duplicate=row_hash in duplicate_hashes,
            currency_mismatch=row.currency != account.currency,
            hash=row_hash,
        ))

    return ImportPreviewResponse(rows=rows, warnings=warnings)


@router.post("/mediobanca/confirm", response_model=ImportConfirmResponse)
async def confirm_mediobanca(
    data: ImportConfirmRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    account = await _get_account(db, data.account_id, user.id)

    rows_with_hashes = []
    for row in data.rows:
        amount = Decimal(str(row.amount))
        row_hash = compute_import_hash(data.account_id, row.date, amount, row.description)
        rows_with_hashes.append((row, amount, row_hash))

    duplicate_hashes = await _existing_hashes(db, data.account_id, [h for _, _, h in rows_with_hashes])

    imported = 0
    skipped = 0
    for row, amount, row_hash in rows_with_hashes:
        if row_hash in duplicate_hashes:
            skipped += 1
            continue

        tx_datetime = datetime.combine(row.date, time(12, 0), tzinfo=timezone.utc)
        tx = Transaction(
            user_id=user.id,
            account_id=data.account_id,
            category_id=row.category_id,
            amount=amount,
            type=row.type,
            note=row.description,
            date=tx_datetime,
            import_hash=row_hash,
            is_reconciliation=False,
        )
        db.add(tx)

        if row.type == "income":
            account.balance += amount
        else:
            account.balance -= amount

        imported += 1

    await db.commit()
    return ImportConfirmResponse(imported=imported, skipped_duplicates=skipped)
