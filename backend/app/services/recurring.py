from datetime import date, datetime, timezone

from dateutil.relativedelta import relativedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.recurring_transaction import RecurringTransaction
from app.models.transaction import Transaction
from app.services.holidays import next_business_day

INTERVALS = {
    "weekly": relativedelta(weeks=1),
    "monthly": relativedelta(months=1),
    "bimonthly": relativedelta(months=2),
    "quarterly": relativedelta(months=3),
}


def next_raw_date(rt: RecurringTransaction) -> date | None:
    """Prossima data di addebito 'grezza' (prima dello shift festivi), o None se la
    ricorrenza è terminata."""
    if rt.last_run_date is None:
        nxt = rt.start_date
    else:
        nxt = rt.last_run_date + INTERVALS[rt.frequency]
    if rt.end_date is not None and nxt > rt.end_date:
        return None
    return nxt


async def process_due_recurring(db: AsyncSession) -> None:
    """Genera le transazioni per tutte le occorrenze di ricorrenze attive la cui data
    (eventualmente spostata al primo giorno lavorativo) è oggi o nel passato."""
    today = date.today()
    result = await db.execute(
        select(RecurringTransaction).where(RecurringTransaction.is_active == True)
    )
    recurrences = result.scalars().all()

    for rt in recurrences:
        while True:
            raw = next_raw_date(rt)
            if raw is None:
                break
            shifted = next_business_day(raw)
            if shifted > today:
                break

            tx = Transaction(
                user_id=rt.user_id,
                account_id=rt.account_id,
                category_id=rt.category_id,
                amount=rt.amount,
                type=rt.type,
                note=rt.description,
                date=datetime(shifted.year, shifted.month, shifted.day, tzinfo=timezone.utc),
            )
            db.add(tx)

            rt.last_run_date = raw

    await db.commit()


def projected_occurrences_in_range(rt: RecurringTransaction, start: date, end: date, today: date) -> list[date]:
    """Date (già spostate sul primo giorno lavorativo) delle occorrenze di `rt` che
    cadono nell'intervallo [start, end] e non sono ancora state generate (data > oggi)."""
    occurrences: list[date] = []
    raw = next_raw_date(rt)
    while raw is not None:
        shifted = next_business_day(raw)
        if shifted > end:
            break
        if shifted >= start and shifted > today:
            occurrences.append(shifted)
        if rt.end_date is not None and raw + INTERVALS[rt.frequency] > rt.end_date:
            raw = None
        else:
            raw = raw + INTERVALS[rt.frequency]
    return occurrences
