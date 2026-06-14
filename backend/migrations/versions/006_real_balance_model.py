"""rename accounts.balance to opening_balance and back out existing transactions

Revision ID: 006
Revises: 005
Create Date: 2026-06-14 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("accounts", "balance", new_column_name="opening_balance")
    op.execute("""
        UPDATE accounts a
        SET opening_balance = a.opening_balance - COALESCE((
            SELECT SUM(CASE WHEN t.type = 'income' THEN t.amount
                            WHEN t.type = 'expense' THEN -t.amount
                            ELSE 0 END)
            FROM transactions t
            WHERE t.account_id = a.id
        ), 0)
    """)


def downgrade() -> None:
    op.execute("""
        UPDATE accounts a
        SET opening_balance = a.opening_balance + COALESCE((
            SELECT SUM(CASE WHEN t.type = 'income' THEN t.amount
                            WHEN t.type = 'expense' THEN -t.amount
                            ELSE 0 END)
            FROM transactions t
            WHERE t.account_id = a.id
        ), 0)
    """)
    op.alter_column("accounts", "opening_balance", new_column_name="balance")
