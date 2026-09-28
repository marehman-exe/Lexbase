"""add suggested_queries table

Revision ID: a1f3c8d92e01
Revises: 28009df95d4e
Create Date: 2026-09-10 00:00:00.000000
"""
# Standard typing imports used by Alembic for revision metadata fields
from typing import Sequence, Union

# sa provides column types and SQL expression helpers for table creation
import sqlalchemy as sa
# op provides all DDL operations such as create_table and create_index
from alembic import op
# postgresql dialect for UUID columns with native Postgres UUID type
from sqlalchemy.dialects import postgresql

# This migration follows 28009df95d4e in the chain
revision: str = 'a1f3c8d92e01'
down_revision: Union[str, None] = '28009df95d4e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Create the suggested_queries table for storing TF-IDF keyphrase chips
def upgrade() -> None:
    # Create the table that stores auto-generated search suggestion chips per document
    op.create_table(
        "suggested_queries",
        # Primary key UUID for each suggestion row
        sa.Column("id",          postgresql.UUID(as_uuid=True), primary_key=True),
        # firm_id links the suggestion to a firm; cascades on firm deletion
        sa.Column("firm_id",     postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("firms.id", ondelete="CASCADE"), nullable=False),
        # document_id links the suggestion to its source document; cascades on deletion
        sa.Column("document_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        # The keyphrase text shown as a clickable chip in the UI
        sa.Column("query_text",  sa.String(500), nullable=False),
        # Timestamp recording when the suggestion was generated
        sa.Column("created_at",  sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    # Index on firm_id to make per-firm suggestion lookups fast
    op.create_index("ix_suggested_queries_firm_id", "suggested_queries", ["firm_id"])


# Drop the suggested_queries table and its index to reverse the upgrade
def downgrade() -> None:
    # Drop the firm_id index before dropping the table it references
    op.drop_index("ix_suggested_queries_firm_id", table_name="suggested_queries")
    # Remove the suggested_queries table entirely
    op.drop_table("suggested_queries")
