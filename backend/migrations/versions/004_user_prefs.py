"""add currency and default_account_id to users

Revision ID: 004
Revises: 003
Create Date: 2026-06-14 00:00:00.000000
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("currency", sa.String(3), nullable=False, server_default="EUR"))
    op.add_column("users", sa.Column("default_account_id", UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "default_account_id")
    op.drop_column("users", "currency")
