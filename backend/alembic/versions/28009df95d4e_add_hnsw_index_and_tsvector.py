"""add HNSW index and tsvector column for hybrid search

Revision ID: 28009df95d4e
Revises: 23c3bd9bb534
Create Date: 2025-01-01 00:00:00.000000
"""
# Standard typing imports used by Alembic for revision metadata fields
from typing import Sequence, Union
# op provides all DDL operations for executing raw SQL migrations
from alembic import op
# sa imported for consistency with other migration files
import sqlalchemy as sa

# This migration follows 23c3bd9bb534 in the chain
revision: str = '28009df95d4e'
down_revision: Union[str, None] = '23c3bd9bb534'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Add the HNSW vector index and the tsvector full-text search column
def upgrade() -> None:
    # M6 — HNSW index on the embedding column using cosine distance operator class.
    # Built AFTER data exists — building on an empty table is wasteful and
    # the index won't be used by the planner until it has rows to justify it.
    op.execute("""
        CREATE INDEX ix_chunks_embedding_hnsw
        ON chunks
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """)

    # M7 — tsvector column for full-text search (English dictionary)
    # GENERATED ALWAYS means Postgres keeps it updated automatically.
    op.execute("""
        ALTER TABLE chunks
        ADD COLUMN text_search tsvector
        GENERATED ALWAYS AS (to_tsvector('english', text)) STORED
    """)

    # M7 — GIN index on the tsvector column for efficient keyword lookups
    op.execute("""
        CREATE INDEX ix_chunks_text_search
        ON chunks
        USING gin (text_search)
    """)


# Remove the HNSW index and tsvector column added in upgrade
def downgrade() -> None:
    # Drop the keyword search GIN index first before removing its source column
    op.execute("DROP INDEX IF EXISTS ix_chunks_text_search")
    # Remove the generated tsvector column from the chunks table
    op.execute("ALTER TABLE chunks DROP COLUMN IF EXISTS text_search")
    # Drop the HNSW vector index last so vector search is disabled cleanly
    op.execute("DROP INDEX IF EXISTS ix_chunks_embedding_hnsw")
