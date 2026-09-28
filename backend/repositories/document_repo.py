# document_repo.py — all DB access for documents and chunks
# firm_id is required on every method that touches firm data.

# uuid for typing all document and firm ID parameters
import uuid
# SQLAlchemy Session type used throughout this repository
from sqlalchemy.orm import Session

# ORM models for documents, their text chunks, and status lifecycle values
from models.orm import Document, Chunk, DocumentStatus
# BaseRepository provides the shared db session attribute
from repositories.base import BaseRepository


# Guard function that raises immediately if firm_id is None
def _require_firm_id(firm_id: uuid.UUID | None) -> uuid.UUID:
    """
    Hard guard: raise immediately if firm_id is None.

    Super Admin accounts have firm_id=None in their JWT. They are excluded from
    all data endpoints by require_role(), but this guard is a second line of
    defence — if a future developer accidentally adds SUPER_ADMIN to a
    require_role() call, every data-touching method will still refuse to run
    rather than silently returning cross-firm data (NULL = NULL is False in SQL,
    but Python would pass None to the query and we must not rely on that).
    """
    if firm_id is None:
        raise PermissionError(
            "firm_id is None — this user has no firm and cannot access firm data"
        )
    return firm_id


# Repository class for all document and chunk database operations
class DocumentRepository(BaseRepository):

    # ── document queries ───────────────────────────────────────────────────

    # Count how many documents belong to a specific firm regardless of status
    def count_documents_in_firm(self, firm_id: uuid.UUID | None) -> int:
        """Count all documents for this firm (any status)."""
        firm_id = _require_firm_id(firm_id)
        return (
            self.db.query(Document)
            .filter(Document.firm_id == firm_id)
            .count()
        )

    # Insert a new document row into the database with status set to pending
    def create_document(
        self,
        firm_id: uuid.UUID | None,
        uploaded_by: uuid.UUID,
        original_filename: str,
        stored_filename: str,
        size_bytes: int,
    ) -> Document:
        """Insert a document row with status=pending."""
        firm_id = _require_firm_id(firm_id)
        # Build the Document ORM object with a fresh UUID and pending status
        doc = Document(
            id=uuid.uuid4(),
            firm_id=firm_id,
            uploaded_by=uploaded_by,
            original_filename=original_filename,
            stored_filename=stored_filename,
            size_bytes=size_bytes,
            status=DocumentStatus.PENDING,
        )
        self.db.add(doc)
        # Flush to get the auto-generated fields without committing the transaction
        self.db.flush()
        return doc

    # Return a specific document only if it belongs to the given firm
    def get_document(self, firm_id: uuid.UUID | None, document_id: uuid.UUID) -> Document | None:
        """
        Return a document only if it belongs to firm_id.
        Returns None (caller raises 404) if it belongs to another firm.
        """
        firm_id = _require_firm_id(firm_id)
        # The firm_id filter ensures cross-firm access is impossible at the query level
        return (
            self.db.query(Document)
            .filter(Document.id == document_id, Document.firm_id == firm_id)
            .first()
        )

    # Return all documents for this firm sorted by newest first
    def list_documents(self, firm_id: uuid.UUID | None) -> list[Document]:
        """All documents for this firm, newest first."""
        firm_id = _require_firm_id(firm_id)
        return (
            self.db.query(Document)
            .filter(Document.firm_id == firm_id)
            .order_by(Document.created_at.desc())
            .all()
        )

    # Update a document's status and optionally its page count or error message
    def set_status(
        self,
        document: Document,
        status: DocumentStatus,
        page_count: int | None = None,
        error_message: str | None = None,
    ) -> None:
        """Update document status in place. Caller must commit."""
        document.status = status
        # Only write page_count when the caller explicitly provides a value
        if page_count is not None:
            document.page_count = page_count
        # Only write error_message when the caller explicitly provides a value
        if error_message is not None:
            document.error_message = error_message
        # Flush so the change is visible within the current transaction
        self.db.flush()

    # Delete a document row and let the database cascade to its chunks
    def delete_document(self, document: Document) -> None:
        """Delete the document row — cascade removes its chunks."""
        self.db.delete(document)
        self.db.flush()

    # ── chunk queries ──────────────────────────────────────────────────────

    # Count how many chunks exist for a given document within a firm
    def count_chunks(self, firm_id: uuid.UUID | None, document_id: uuid.UUID) -> int:
        """Count chunks for a specific document."""
        firm_id = _require_firm_id(firm_id)
        return (
            self.db.query(Chunk)
            .filter(Chunk.firm_id == firm_id, Chunk.document_id == document_id)
            .count()
        )

    # Insert many chunk rows at once using a single bulk SQL statement
    def insert_chunks_batch(self, chunks: list[dict]) -> None:
        """
        Bulk-insert chunk rows.
        Each dict must have: firm_id, document_id, chunk_index, page_number,
                             text, token_count.
        Embedding is left NULL — filled in by M6.
        """
        if not chunks:
            return
        # Merge each chunk dict with default id and embedding fields
        self.db.bulk_insert_mappings(Chunk, [
            {
                "id": uuid.uuid4(),
                "embedding": None,        # default — overridden if caller supplies it
                "embedding_model": None,
                **c,                      # caller values win — embedding included if present
            }
            for c in chunks
        ])
        # Flush to make the new rows visible within the current transaction
        self.db.flush()
