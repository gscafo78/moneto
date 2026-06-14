"""add email verification, password reset, email change fields, admin flag and app_settings

Revision ID: 007
Revises: 006
Create Date: 2026-06-14 00:00:00.000000
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_admin", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("users", sa.Column("email_verified", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("users", sa.Column("verification_token", sa.String(), nullable=True))
    op.add_column("users", sa.Column("verification_token_expires", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("reset_token", sa.String(), nullable=True))
    op.add_column("users", sa.Column("reset_token_expires", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("pending_email", sa.String(), nullable=True))
    op.add_column("users", sa.Column("pending_email_token", sa.String(), nullable=True))
    op.add_column("users", sa.Column("pending_email_token_expires", sa.DateTime(timezone=True), nullable=True))

    # Utenti già esistenti: nessuna verifica retroattiva richiesta
    op.execute("UPDATE users SET email_verified = true")

    # Il primo utente registrato diventa admin
    op.execute("""
        UPDATE users SET is_admin = true
        WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
    """)

    op.create_table(
        "app_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("allow_registration", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.execute("INSERT INTO app_settings (id, allow_registration) VALUES (1, false)")


def downgrade() -> None:
    op.drop_table("app_settings")
    op.drop_column("users", "pending_email_token_expires")
    op.drop_column("users", "pending_email_token")
    op.drop_column("users", "pending_email")
    op.drop_column("users", "reset_token_expires")
    op.drop_column("users", "reset_token")
    op.drop_column("users", "verification_token_expires")
    op.drop_column("users", "verification_token")
    op.drop_column("users", "email_verified")
    op.drop_column("users", "is_admin")
