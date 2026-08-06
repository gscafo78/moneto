import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.transaction import Transaction


async def compute_balances(
    db: AsyncSession,
    account_ids: list[uuid.UUID],
    as_of: datetime | None = None,
) -> dict[uuid.UUID, Decimal]:
    """Saldo reale di ciascun conto: opening_balance + entrate - uscite +/- trasferimenti."""
    if not account_ids:
        return {}
    as_of = as_of or datetime.now(timezone.utc)
    account_id_set = set(account_ids)

    accounts_result = await db.execute(
        select(Account.id, Account.opening_balance).where(Account.id.in_(account_ids))
    )
    balances: dict[uuid.UUID, Decimal] = {a.id: a.opening_balance for a in accounts_result}

    # Income / expense
    signed_amount = case(
        (Transaction.type == "income", Transaction.amount),
        (Transaction.type == "expense", -Transaction.amount),
        else_=Decimal("0"),
    )
    sums_result = await db.execute(
        select(Transaction.account_id, func.sum(signed_amount))
        .where(
            Transaction.account_id.in_(account_ids),
            Transaction.type.in_(["income", "expense"]),
            Transaction.date <= as_of,
        )
        .group_by(Transaction.account_id)
    )
    for account_id, total in sums_result:
        balances[account_id] = balances.get(account_id, Decimal("0")) + (total or Decimal("0"))

    # Transfers: debit source, credit destination
    transfer_result = await db.execute(
        select(Transaction.account_id, Transaction.to_account_id, Transaction.amount)
        .where(
            Transaction.type == "transfer",
            Transaction.date <= as_of,
            or_(
                Transaction.account_id.in_(account_ids),
                Transaction.to_account_id.in_(account_ids),
            ),
        )
    )
    for src_id, dst_id, amount in transfer_result:
        if src_id in account_id_set:
            balances[src_id] = balances.get(src_id, Decimal("0")) - (amount or Decimal("0"))
        if dst_id and dst_id in account_id_set:
            balances[dst_id] = balances.get(dst_id, Decimal("0")) + (amount or Decimal("0"))

    return balances


async def compute_balance(
    db: AsyncSession,
    account_id: uuid.UUID,
    as_of: datetime | None = None,
) -> Decimal:
    balances = await compute_balances(db, [account_id], as_of)
    return balances.get(account_id, Decimal("0"))
