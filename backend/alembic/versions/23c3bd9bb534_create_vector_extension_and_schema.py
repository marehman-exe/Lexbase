"""create vector extension and schema

Revision ID: 23c3bd9bb534
Revises:
Create Date: 2026-08-31 14:35:58.206077

"""
# Standard typing imports used by Alembic for revision metadata fields
from typing import Sequence, Union

# op provides all DDL operations such as create_table and create_index
from alembic import op
# sa provides column types, constraints, and SQL expression helpers
import sqlalchemy as sa
# postgresql dialect for UUID columns with native Postgres UUID type
from sqlalchemy.dialects import postgresql
# Vector column type from the pgvector extension for storing dense embeddings
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = '23c3bd9bb534'
# down_revision is None because this is the first migration in the chain
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Apply all schema changes: enable vector extension and create all core tables
def upgrade() -> None:
    # vector extension must exist before the chunks table
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Create the firms table to hold law firm accounts
    op.create_table(
        "firms",
        sa.Column("id",         postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name",       sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active",  sa.Boolean, default=True, nullable=False),
    )

    # Create the users table to hold all system users across all firms
    op.create_table(
        "users",
        sa.Column("id",             postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email",          sa.String(255), nullable=False),
        sa.Column("password_hash",  sa.String(255), nullable=False),
        sa.Column("role",           sa.Enum("super_admin","lawyer","associate","paralegal", name="userrole"), nullable=False),
        sa.Column("firm_id",        postgresql.UUID(as_uuid=True), sa.ForeignKey("firms.id"), nullable=True),
        sa.Column("is_active",      sa.Boolean, default=True,  nullable=False),
        sa.Column("must_change_pw", sa.Boolean, default=False, nullable=False),
        sa.Column("last_login",     sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at",     sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    # Unique functional index on lower(email) to enforce case-insensitive uniqueness
    op.create_index("ix_users_email_lower", "users", [sa.text("lower(email)")], unique=True)

    # Create the refresh_tokens table for storing hashed JWT refresh tokens
    op.create_table(
        "refresh_tokens",
        sa.Column("id",         postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id",    postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id",  ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(255), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked",    sa.Boolean, default=False, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Create the documents table to track uploaded PDF files and their processing status
    op.create_table(
        "documents",
        sa.Column("id",                postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("firm_id",           postgresql.UUID(as_uuid=True), sa.ForeignKey("firms.id",  ondelete="CASCADE"), nullable=False),
        sa.Column("uploaded_by",       postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("stored_filename",   sa.String(255), nullable=False, unique=True),
        sa.Column("size_bytes",        sa.BigInteger, nullable=False),
        sa.Column("page_count",        sa.Integer, nullable=True),
        sa.Column("status",            sa.Enum("pending","processing","ready","failed", name="documentstatus"), nullable=False, server_default="pending"),
        sa.Column("error_message",     sa.Text, nullable=True),
        sa.Column("created_at",        sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",        sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    # Index on firm_id so per-firm document list queries stay fast
    op.create_index("ix_documents_firm_id", "documents", ["firm_id"])

    # Create the chunks table to store text segments and their vector embeddings
    op.create_table(
        "chunks",
        sa.Column("id",              postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("firm_id",         postgresql.UUID(as_uuid=True), sa.ForeignKey("firms.id",      ondelete="CASCADE"), nullable=False),
        sa.Column("document_id",     postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id",  ondelete="CASCADE"), nullable=False),
        sa.Column("chunk_index",     sa.Integer, nullable=False),
        sa.Column("page_number",     sa.Integer, nullable=False),
        sa.Column("text",            sa.Text, nullable=False),
        sa.Column("token_count",     sa.Integer, nullable=False),
        # 384-dimensional vector matching the output size of the BGE-small model
        sa.Column("embedding",       Vector(384), nullable=True),
        sa.Column("embedding_model", sa.String(100), nullable=True),
        sa.Column("created_at",      sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    # Index on firm_id so per-firm vector search queries can filter efficiently
    op.create_index("ix_chunks_firm_id", "chunks", ["firm_id"])

    # Create the query_logs table to record every search query for analytics and auditing
    op.create_table(
        "query_logs",
        sa.Column("id",             postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("firm_id",        postgresql.UUID(as_uuid=True), sa.ForeignKey("firms.id",  ondelete="CASCADE"), nullable=False),
        sa.Column("user_id",        postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id",  ondelete="SET NULL"), nullable=False),
        sa.Column("query_text",     sa.Text, nullable=False),
        sa.Column("result_count",   sa.Integer, nullable=False, default=0),
        sa.Column("top_score",      sa.Float, nullable=True),
        sa.Column("generation_ran", sa.Boolean, default=False, nullable=False),
        sa.Column("was_refused",    sa.Boolean, default=False, nullable=False),
        sa.Column("refusal_reason", sa.Text, nullable=True),
        sa.Column("latency_ms",     sa.Integer, nullable=True),
        sa.Column("created_at",     sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


# Reverse all upgrade changes in the correct dependency order
def downgrade() -> None:
    # Drop tables in reverse order so foreign key constraints are satisfied
    op.drop_table("query_logs")
    op.drop_table("chunks")
    op.drop_table("documents")
    op.drop_table("refresh_tokens")
    op.drop_table("users")
    op.drop_table("firms")
    # Drop the custom Postgres enum types created alongside their tables
    op.execute("DROP TYPE IF EXISTS documentstatus")
    op.execute("DROP TYPE IF EXISTS userrole")
    # Remove the pgvector extension last since chunks no longer needs it
    op.execute("DROP EXTENSION IF EXISTS vector")
