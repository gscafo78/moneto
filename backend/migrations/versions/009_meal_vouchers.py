"""add meal voucher value to accounts and voucher quantity to transactions

Revision ID: 009
Revises: 008
Create Date: 2026-06-15 00:00:00.000000
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("accounts", sa.Column("meal_voucher_value", sa.Numeric(12, 2), nullable=True))
    op.add_column("transactions", sa.Column("voucher_quantity", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("transactions", "voucher_quantity")
    op.drop_column("accounts", "meal_voucher_value")
