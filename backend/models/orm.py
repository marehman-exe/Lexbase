# orm.py — SQLAlchemy 2.0 declarative models for LexBase

# Import enum for creating fixed sets of allowed string values (roles, statuses)
import enum
# Import uuid for generating unique IDs for every database row
import uuid
# Import datetime for timestamp column type hints
from datetime import datetime

# Import the pgvector column type for storing embedding vectors in PostgreSQL
from pgvector.sqlalchemy import Vector
# Import all the column types and SQL functions used in the table definitions
from sqlalchemy import (
    BigInteger, Boolean, DateTime, Enum, ForeignKey,
    Index, Integer, String, Text, func,
)
# Import the PostgreSQL-specific UUID column type
from sqlalchemy.dialects.postgresql import UUID
# Import the base class and mapping tools for defining ORM models
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

# Base class that all ORM models inherit from — links Python classes to database tables
class Base(DeclarativeBase):
    pass


# Enum listing all the roles a user can have in the system
class UserRole(str, enum.Enum):
    # Super Admin manages the whole platform — not tied to any firm
    SUPER_ADMIN = "super_admin"
    # Lawyer is the main account holder who owns a firm and can upload documents
    LAWYER      = "lawyer"
    # Associate can search and generate summaries but cannot upload documents
    ASSOCIATE   = "associate"
    # Paralegal can search but cannot generate AI summaries
    PARALEGAL   = "paralegal"


# Enum tracking the processing state of an uploaded document
class DocumentStatus(str, enum.Enum):
    # Document has been uploaded but processing has not started yet
    PENDING    = "pending"
    # Document is currently being parsed and indexed
    PROCESSING = "processing"
    # Document was processed successfully and is ready for search
    READY      = "ready"
    # Document processing failed due to an error
    FAILED     = "failed"


# Firm table — represents a law firm that owns users and documents
class Firm(Base):
    __tablename__ = "firms"

    # Unique identifier for this firm, generated automatically as a UUID
    id         : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # The human-readable name of the law firm
    name       : Mapped[str]       = mapped_column(String(255), nullable=False)
    # Timestamp recorded automatically when the firm was created
    created_at : Mapped[datetime]  = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    # Flag that controls whether the firm account is active or suspended
    is_active  : Mapped[bool]      = mapped_column(Boolean, default=True, nullable=False)

    # relationships
    # All users that belong to this firm
    users     : Mapped[list["User"]]     = relationship("User",     back_populates="firm")
    # All documents that belong to this firm
    documents : Mapped[list["Document"]] = relationship("Document", back_populates="firm")


# User table — represents a person who can log in and use the system
class User(Base):
    __tablename__ = "users"

    # Unique identifier for this user, generated automatically as a UUID
    id            : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # The user's email address used for login
    email         : Mapped[str]       = mapped_column(String(255), nullable=False)
    # The bcrypt-hashed version of the user's password — never stored in plain text
    password_hash : Mapped[str]       = mapped_column(String(255), nullable=False)
    # The user's role in the system (Lawyer, Associate, Paralegal, or Super Admin)
    role          : Mapped[UserRole]  = mapped_column(Enum(UserRole, name="userrole", values_callable=lambda x: [e.value for e in x]), nullable=False)
    # The ID of the firm this user belongs to (null for Super Admin who has no firm)
    firm_id       : Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("firms.id"), nullable=True)
    # Flag showing whether the user's account is currently active
    is_active     : Mapped[bool]      = mapped_column(Boolean, default=True, nullable=False)
    # Flag that forces the user to change their password on next login
    must_change_pw: Mapped[bool]      = mapped_column(Boolean, default=False, nullable=False)
    # Timestamp of when the user last successfully logged in
    last_login    : Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Timestamp recorded automatically when the account was created
    created_at    : Mapped[datetime]  = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # relationships
    # The firm this user belongs to
    firm           : Mapped["Firm | None"]          = relationship("Firm", back_populates="users")
    # All refresh tokens issued to this user
    refresh_tokens : Mapped[list["RefreshToken"]]   = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    # All documents uploaded by this user
    documents      : Mapped[list["Document"]]        = relationship("Document", back_populates="uploaded_by_user")
    # All search queries made by this user (for audit logging)
    query_logs     : Mapped[list["QueryLog"]]        = relationship("QueryLog", back_populates="user")

    # indexes
    # Unique index on the lowercased email so logins are case-insensitive
    __table_args__ = (
        Index("ix_users_email_lower", func.lower(email), unique=True),
    )


# RefreshToken table — stores hashed refresh tokens so they can be validated and revoked
class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    # Unique identifier for this token record
    id         : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # The user this refresh token belongs to — deleted when the user is deleted
    user_id    : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    # The hashed value of the actual token string — never store the raw token
    token_hash : Mapped[str]       = mapped_column(String(255), nullable=False, unique=True)
    # The date and time after which this token is no longer valid
    expires_at : Mapped[datetime]  = mapped_column(DateTime(timezone=True), nullable=False)
    # Flag set to True when the token has been explicitly invalidated (e.g. on logout)
    revoked    : Mapped[bool]      = mapped_column(Boolean, default=False, nullable=False)
    # Timestamp recorded automatically when this token was issued
    created_at : Mapped[datetime]  = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # relationships
    # The user who owns this refresh token
    user : Mapped["User"] = relationship("User", back_populates="refresh_tokens")


# Document table — represents a PDF file uploaded by a Lawyer
class Document(Base):
    __tablename__ = "documents"

    # Unique identifier for this document record
    id                : Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # The firm that owns this document — deleted when the firm is deleted
    firm_id           : Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), ForeignKey("firms.id", ondelete="CASCADE"), nullable=False)
    # The user who uploaded this document
    uploaded_by       : Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    # The filename as the user named it before uploading
    original_filename : Mapped[str]            = mapped_column(String(255), nullable=False)
    # The UUID-based filename used on disk — never exposes the original name to the filesystem
    stored_filename   : Mapped[str]            = mapped_column(String(255), nullable=False, unique=True)  # UUID on disk
    # The size of the uploaded file in bytes
    size_bytes        : Mapped[int]            = mapped_column(BigInteger, nullable=False)
    # How many pages the PDF contains (filled in after processing)
    page_count        : Mapped[int | None]     = mapped_column(Integer, nullable=True)
    # Current processing status of this document
    status            : Mapped[DocumentStatus] = mapped_column(Enum(DocumentStatus, name="documentstatus", values_callable=lambda x: [e.value for e in x]), nullable=False, default=DocumentStatus.PENDING)
    # Error message stored here if processing failed, otherwise null
    error_message     : Mapped[str | None]     = mapped_column(Text, nullable=True)
    # Timestamp recorded automatically when this document was uploaded
    created_at        : Mapped[datetime]       = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    # Timestamp updated automatically whenever this document record changes
    updated_at        : Mapped[datetime]       = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # relationships
    # The firm that owns this document
    firm             : Mapped["Firm"]     = relationship("Firm", back_populates="documents")
    # The user who uploaded this document
    uploaded_by_user : Mapped["User"]     = relationship("User", back_populates="documents", foreign_keys=[uploaded_by])
    # All text chunks extracted from this document's pages
    chunks           : Mapped[list["Chunk"]] = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")

    # indexes
    # Index on firm_id for fast queries that filter documents by firm
    __table_args__ = (
        Index("ix_documents_firm_id", "firm_id"),
    )


# Chunk table — stores individual text passages extracted from a document, with embeddings
class Chunk(Base):
    __tablename__ = "chunks"

    # Unique identifier for this text chunk
    id              : Mapped[uuid.UUID]       = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # The firm that owns the document this chunk came from
    firm_id         : Mapped[uuid.UUID]       = mapped_column(UUID(as_uuid=True), ForeignKey("firms.id", ondelete="CASCADE"), nullable=False)
    # The document this chunk was extracted from
    document_id     : Mapped[uuid.UUID]       = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    # The sequential position of this chunk within its document (0-based)
    chunk_index     : Mapped[int]             = mapped_column(Integer, nullable=False)
    # The page number in the original PDF where this chunk's text appears
    page_number     : Mapped[int]             = mapped_column(Integer, nullable=False)
    # The actual text content of this passage
    text            : Mapped[str]             = mapped_column(Text, nullable=False)
    # How many tokens this chunk contains (used to stay within model limits)
    token_count     : Mapped[int]             = mapped_column(Integer, nullable=False)
    # The 384-dimensional vector embedding of the text (used for semantic search)
    embedding       : Mapped[list[float] | None] = mapped_column(Vector(384), nullable=True)
    # The name of the embedding model that produced this vector
    embedding_model : Mapped[str | None]      = mapped_column(String(100), nullable=True)
    # Timestamp recorded automatically when this chunk was created
    created_at      : Mapped[datetime]        = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # relationships
    # The document this chunk belongs to
    document : Mapped["Document"] = relationship("Document", back_populates="chunks")

    # indexes — HNSW added in a later migration, after data is loaded
    # Index on firm_id so searches can quickly filter chunks to the right firm
    __table_args__ = (
        Index("ix_chunks_firm_id", "firm_id"),
    )


# QueryLog table — audit record of every search or generation request made by a user
class QueryLog(Base):
    __tablename__ = "query_logs"

    # Unique identifier for this log entry
    id               : Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # The firm whose data was queried in this request
    firm_id          : Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("firms.id", ondelete="CASCADE"), nullable=False)
    # The user who made this query (set to null if the user is later deleted)
    user_id          : Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=False)
    # The exact text the user searched for
    query_text       : Mapped[str]        = mapped_column(Text, nullable=False)
    # How many results were returned to the user
    result_count     : Mapped[int]        = mapped_column(Integer, nullable=False, default=0)
    # The similarity score of the best matching result (0–1 scale)
    top_score        : Mapped[float | None] = mapped_column(nullable=True)
    # True if an AI-generated answer was produced alongside the search results
    generation_ran   : Mapped[bool]       = mapped_column(Boolean, default=False, nullable=False)
    # True if the query was rejected (too short, off-topic, or below relevance floor)
    was_refused      : Mapped[bool]       = mapped_column(Boolean, default=False, nullable=False)
    # Explanation of why the query was refused, if it was
    refusal_reason   : Mapped[str | None] = mapped_column(Text, nullable=True)
    # How long the entire query took to process in milliseconds
    latency_ms       : Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Timestamp recorded automatically when the query was made
    created_at       : Mapped[datetime]   = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # relationships
    # The user who made this query
    user : Mapped["User"] = relationship("User", back_populates="query_logs")


# SuggestedQuery table — stores keyphrases extracted from documents to show as search chips
class SuggestedQuery(Base):
    __tablename__ = "suggested_queries"

    # Unique identifier for this suggestion record
    id          : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # The firm whose documents this suggestion was generated from
    firm_id     : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("firms.id", ondelete="CASCADE"), nullable=False)
    # The specific document this keyphrase came from
    document_id : Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    # The suggested search phrase shown to users as a clickable chip
    query_text  : Mapped[str]       = mapped_column(String(500), nullable=False)
    # Timestamp recorded automatically when this suggestion was created
    created_at  : Mapped[datetime]  = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # indexes
    # Index on firm_id so suggestion lookups can quickly filter by firm
    __table_args__ = (
        Index("ix_suggested_queries_firm_id", "firm_id"),
    )


# ChatHistory table — persists every Research Page query/answer pair per user
class ChatHistory(Base):
    __tablename__ = "chat_history"

    # Unique identifier for this chat history record
    id           : Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # The firm the querying user belongs to
    firm_id      : Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), ForeignKey("firms.id", ondelete="CASCADE"), nullable=False)
    # The user who made this query
    user_id      : Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    # The text the user searched for
    query_text   : Mapped[str]            = mapped_column(Text, nullable=False)
    # Full JSON blob of the /search response (null when search failed)
    search_resp  : Mapped[str | None]     = mapped_column(Text, nullable=True)
    # Full JSON blob of the /generate response (null when generation was not run)
    generate_resp: Mapped[str | None]     = mapped_column(Text, nullable=True)
    # Timestamp recorded when the query was first made
    created_at   : Mapped[datetime]       = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # relationships
    # The user who owns this record
    user : Mapped["User"] = relationship("User")

    # indexes
    # Composite index: filter by user_id + created_at for the 7-day history query
    __table_args__ = (
        Index("ix_chat_history_user_created", "user_id", "created_at"),
    )
