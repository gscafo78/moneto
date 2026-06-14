"""add import_hash and is_reconciliation to transactions

Revision ID: 005
Revises: 004
Create Date: 2026-06-14 00:00:00.000000
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("import_hash", sa.String(64), nullable=True))
    op.add_column("transactions", sa.Column("is_reconciliation", sa.Boolean(), nullable=False, server_default="false"))
    op.create_index(
        "ix_tx_account_import_hash",
        "transactions",
        ["account_id", "import_hash"],
        unique=True,
        postgresql_where=sa.text("import_hash IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_tx_account_import_hash", table_name="transactions")
    op.drop_column("transactions", "is_reconciliation")
    op.drop_column("transactions", "import_hash")
