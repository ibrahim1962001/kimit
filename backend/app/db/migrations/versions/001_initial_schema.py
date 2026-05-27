"""Initial schema — users, datasets, credits, chat, admin roles.

Revision ID: 001
Revises:
Create Date: 2026-05-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("firebase_uid", sa.String(128), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(255)),
        sa.Column("plan", sa.String(32), nullable=False, server_default="free"),
        sa.Column("stripe_customer_id", sa.String(128)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_firebase_uid", "users", ["firebase_uid"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "user_credits",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("balance", sa.Float(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(32), nullable=False, server_default="active"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_user_credits_user_id", "user_credits", ["user_id"], unique=True)

    op.create_table(
        "credit_transactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("credit_id", sa.Integer(), sa.ForeignKey("user_credits.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("reason", sa.String(255)),
        sa.Column("performed_by", sa.String(128)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "datasets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.String(512), nullable=False),
        sa.Column("row_count", sa.Integer(), server_default="0"),
        sa.Column("col_count", sa.Integer(), server_default="0"),
        sa.Column("columns", sa.JSON(), server_default="[]"),
        sa.Column("dtypes", sa.JSON(), server_default="{}"),
        sa.Column("null_counts", sa.JSON(), server_default="{}"),
        sa.Column("source", sa.String(64), server_default="upload"),
        sa.Column("storage_path", sa.String(1024)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_datasets_user_id", "datasets", ["user_id"])

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dataset_id", sa.Integer(), sa.ForeignKey("datasets.id", ondelete="SET NULL")),
        sa.Column("session_id", sa.String(64), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_chat_messages_session_id", "chat_messages", ["session_id"])

    op.create_table(
        "charge_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("transfer_number", sa.String(128)),
        sa.Column("screenshot_url", sa.String(1024)),
        sa.Column("notes", sa.Text()),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("reviewed_by", sa.String(128)),
        sa.Column("review_note", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "admin_roles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("firebase_uid", sa.String(128), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("role", sa.String(32), nullable=False, server_default="sub_admin"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("can_approve_charges", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("added_by", sa.String(128)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_admin_roles_firebase_uid", "admin_roles", ["firebase_uid"], unique=True)


def downgrade() -> None:
    op.drop_table("admin_roles")
    op.drop_table("charge_requests")
    op.drop_table("chat_messages")
    op.drop_table("datasets")
    op.drop_table("credit_transactions")
    op.drop_table("user_credits")
    op.drop_table("users")
