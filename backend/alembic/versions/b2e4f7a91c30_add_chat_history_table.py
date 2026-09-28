"""add chat_history table

Revision ID: b2e4f7a91c30
Revises: a1f3c8d92e01
Create Date: 2026-09-11 00:00:00.000000
"""
# Standard typing imports used by Alembic for revision metadata fields
from typing import Sequence, Union

# sa provides column types and SQL expression helpers for table creation
import sqlalchemy as sa
# op provides all DDL operations such as create_table and create_index
from alembic import op
# postgresql dialect for UUID columns with native Postgres UUID type
from sqlalchemy.dialects import postgresql

# This migration follows a1f3c8d92e01 in the chain
revision: str = 'b2e4f7a91c30'
down_revision: Union[str, None] = 'a1f3c8d92e01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Create the chat_history table to persist Research Page sessions per user
def upgrade() -> None:
    op.create_table(
        "chat_history",
        # Primary key UUID auto-generated for each history record
        sa.Column("id",            postgresql.UUID(as_uuid=True), primary_key=True),
        # firm_id links the record to a firm; cascades on firm deletion
        sa.Column("firm_id",       postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("firms.id", ondelete="CASCADE"), nullable=False),
        # user_id links the record to the querying user; cascades on user deletion
        sa.Column("user_id",       postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        # The text the user searched for
        sa.Column("query_text",    sa.Text(), nullable=False),
        # JSON blob of the full /search response; null if the search failed
        sa.Column("search_resp",   sa.Text(), nullable=True),
        # JSON blob of the full /generate response; null if generation was not run
        sa.Column("generate_resp", sa.Text(), nullable=True),
        # Timestamp set automatically when the record is inserted
        sa.Column("created_at",    sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    # Composite index supports efficient 7-day history queries by user
    op.create_index("ix_chat_history_user_created", "chat_history", ["user_id", "created_at"])


# Drop the chat_history table and its index to reverse the upgrade
def downgrade() -> None:
    op.drop_index("ix_chat_history_user_created", table_name="chat_history")
    op.drop_table("chat_history")
