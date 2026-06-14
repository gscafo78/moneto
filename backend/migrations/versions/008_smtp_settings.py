"""remove email-change fields, add smtp config to app_settings

Revision ID: 008
Revises: 007
Create Date: 2026-06-14 00:00:00.000000
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("users", "pending_email_token_expires")
    op.drop_column("users", "pending_email_token")
    op.drop_column("users", "pending_email")

    op.add_column("app_settings", sa.Column("smtp_host", sa.String(), nullable=True))
    op.add_column("app_settings", sa.Column("smtp_port", sa.Integer(), nullable=True))
    op.add_column("app_settings", sa.Column("smtp_user", sa.String(), nullable=True))
    op.add_column("app_settings", sa.Column("smtp_password", sa.String(), nullable=True))
    op.add_column("app_settings", sa.Column("smtp_from", sa.String(), nullable=True))
    op.add_column("app_settings", sa.Column("smtp_tls", sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column("app_settings", "smtp_tls")
    op.drop_column("app_settings", "smtp_from")
    op.drop_column("app_settings", "smtp_password")
    op.drop_column("app_settings", "smtp_user")
    op.drop_column("app_settings", "smtp_port")
    op.drop_column("app_settings", "smtp_host")

    op.add_column("users", sa.Column("pending_email", sa.String(), nullable=True))
    op.add_column("users", sa.Column("pending_email_token", sa.String(), nullable=True))
    op.add_column("users", sa.Column("pending_email_token_expires", sa.DateTime(timezone=True), nullable=True))
