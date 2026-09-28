# documents.py — document upload, list, detail, delete, and file-stream endpoints

# Import uuid for working with document IDs as UUIDs
import uuid
# Import datetime for the created_at field in the response schema
from datetime import datetime
# Import Path for building file system paths to stored PDF files
from pathlib import Path

# Import FastAPI tools for routing, background tasks, dependency injection, file uploads, and errors
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, status
# Import FileResponse so the server can stream a PDF file back to the browser
from fastapi.responses import FileResponse
# Import Pydantic for defining the request and response data shapes
from pydantic import BaseModel
# Import the SQLAlchemy session type for database operations
from sqlalchemy.orm import Session

# Import security helpers to enforce authentication and role restrictions
from core.security import get_current_user, get_current_user_optional, require_role
# Import the database session dependency
from db.session import get_db
# Import the User model and UserRole enum for type hints and role checks
from models.orm import User, UserRole
# Import the document database repository for all document CRUD operations
from repositories.document_repo import DocumentRepository
# Import file and validation helpers from the ingestion service
from services.ingestion_service import (
    validate_upload, save_file, delete_file, run_ingestion,
    settings, UPLOAD_DIR,
)

# Create the documents router — all routes here will be prefixed with /documents
router = APIRouter(prefix="/documents", tags=["documents"])

# Calculate the maximum upload size in bytes from the settings value in megabytes
MAX_UPLOAD_BYTES = settings.max_file_size_mb * 1024 * 1024


# ── response schemas ────────────────────────────────────────────────────────

# Shape of a single document returned by the list or detail endpoints
class DocumentOut(BaseModel):
    id: uuid.UUID
    original_filename: str
    size_bytes: int
    page_count: int | None
    status: str
    error_message: str | None
    # Number of text chunks extracted from this document (0 means not processed yet)
    chunk_count: int = 0
    created_at: datetime

    # Allow this model to be built directly from a SQLAlchemy ORM object
    model_config = {"from_attributes": True}


# Shape returned immediately after a successful file upload
class UploadResponse(BaseModel):
    document_id: uuid.UUID
    # Current processing status, e.g. "pending" right after upload
    status: str


# ── routes ──────────────────────────────────────────────────────────────────

# Upload endpoint — accepts a PDF, saves it to disk, queues background processing, returns 202
@router.post("", response_model=UploadResponse, status_code=202)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    # Only Lawyers can upload documents — Associates and Paralegals are not allowed
    current_user: User = Depends(require_role(UserRole.LAWYER)),
):
    """
    Upload a PDF. Returns 202 immediately; ingestion runs in the background.
    Only Lawyers can upload — Associates and Paralegals cannot.
    firm_id comes from the JWT.
    """
    # Read with size guard — stop early if the file is too large
    # Start with empty bytes and read the file in 64 KB pieces
    content = b""
    chunk_size = 64 * 1024   # 64 KB at a time
    while True:
        piece = await file.read(chunk_size)
        # Stop reading when there is nothing left
        if not piece:
            break
        content += piece
        # Reject the upload immediately once we know it is too big
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File exceeds the {settings.max_file_size_mb} MB limit",
            )

    # Check how many documents this firm has already uploaded
    repo = DocumentRepository(db)
    firm_doc_count = repo.count_documents_in_firm(current_user.firm_id)

    # Validate the file type, page count, and firm document limit
    error = validate_upload(file.filename or "", content, firm_doc_count)
    if error:
        raise HTTPException(status_code=400, detail=error)

    # Store under a UUID filename — never use the client-supplied name on disk
    # This prevents path traversal attacks and filename collisions
    stored_name = save_file(content)

    # Create the database record for this document
    doc = repo.create_document(
        firm_id=current_user.firm_id,
        uploaded_by=current_user.id,
        original_filename=file.filename or "unknown.pdf",
        stored_filename=stored_name,
        size_bytes=len(content),
    )
    db.commit()
    db.refresh(doc)

    # Queue background ingestion — runs after this response is sent
    # This parses the PDF, splits it into chunks, and generates embeddings
    background_tasks.add_task(run_ingestion, str(doc.id))

    return UploadResponse(document_id=doc.id, status=doc.status.value)


# List endpoint — returns all documents belonging to the current user's firm
@router.get("", response_model=list[DocumentOut])
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.LAWYER, UserRole.ASSOCIATE, UserRole.PARALEGAL,
        # SUPER_ADMIN is deliberately excluded — spec: Super Admin cannot read
        # any firm's documents. The omission here IS the enforcement point.
    )),
):
    """List all documents for this firm. Readable by all firm members."""
    repo = DocumentRepository(db)
    # Fetch all documents for this firm from the database
    docs = repo.list_documents(current_user.firm_id)
    result = []
    # For each document, also fetch how many chunks it has been split into
    for doc in docs:
        chunk_count = repo.count_chunks(current_user.firm_id, doc.id)
        out = DocumentOut.model_validate(doc)
        out.chunk_count = chunk_count
        result.append(out)
    return result


# Detail endpoint — returns a single document's full status and metadata by ID
@router.get("/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.LAWYER, UserRole.ASSOCIATE, UserRole.PARALEGAL,
        # SUPER_ADMIN deliberately excluded — see list_documents above.
    )),
):
    """Get a single document's status and details. Returns 404 for another firm's document."""
    repo = DocumentRepository(db)
    # Fetch the document — the repo enforces firm_id so cross-firm access returns None
    doc = repo.get_document(current_user.firm_id, document_id)
    # Return 404 if the document doesn't exist or belongs to a different firm
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    chunk_count = repo.count_chunks(current_user.firm_id, doc.id)
    out = DocumentOut.model_validate(doc)
    out.chunk_count = chunk_count
    return out


# Delete endpoint — removes the document record and the PDF file from disk
@router.delete("/{document_id}", status_code=204)
def delete_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    # Only Lawyers can delete documents — Associates and Paralegals cannot
    current_user: User = Depends(require_role(UserRole.LAWYER)),
):
    """
    Delete a document, its chunks, and the file on disk.
    Only the Lawyer can delete. Returns 404 for another firm's document.
    """
    repo = DocumentRepository(db)
    # Look up the document to confirm it exists and belongs to this firm
    doc = repo.get_document(current_user.firm_id, document_id)
    # Return 404 if the document doesn't exist or belongs to a different firm
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Save the filename before deleting the database row
    stored_name = doc.stored_filename
    repo.delete_document(doc)
    db.commit()

    # Remove file after DB commit — never delete a file whose row failed to delete
    # This ensures we don't orphan files if the database transaction fails
    delete_file(stored_name)


# File stream endpoint — sends the raw PDF bytes to the browser for inline viewing
@router.get("/{document_id}/file")
def stream_document_file(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    token: str | None = None,           # query-param fallback (browsers can't send headers)
    download: bool = False,             # ?download=true → attachment (triggers save dialog)
    current_user: User | None = Depends(get_current_user_optional),
):
    """
    Stream the raw PDF file for in-browser viewing.

    Auth: accepts either the standard Authorization: Bearer header OR a ?token=
    query parameter.  The query-param path exists solely for the iframe PDF viewer
    — browsers cannot send custom headers from an <iframe src=...>.

    Tenant-scoped: only returns documents belonging to the caller's firm.
    Content-Disposition: inline so the browser renders rather than downloads.
    """
    # Import token decoder and JWT error class for validating the query-param token
    from core.security import decode_token
    # Import the session factory to open a second DB session for the query-param auth path
    from db.session import SessionLocal
    from jose import JWTError

    # Resolve user from query-param token when the header-based user is absent
    if current_user is None:
        # Return 401 if neither a header token nor a query-param token was provided
        if not token:
            raise HTTPException(status_code=401, detail="Not authenticated")
        # Try to decode the query-param token and reject it if it's invalid
        try:
            payload = decode_token(token)
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid token")
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        # Re-open a DB session to load the user from the token payload
        import uuid as _uuid
        user_id = payload.get("user_id")
        # Reject tokens that have no user ID or are not access tokens
        if not user_id or payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token")
        _db = SessionLocal()
        try:
            # Look up the user by their ID and make sure their account is active
            from models.orm import User as UserModel
            current_user = _db.query(UserModel).filter(
                UserModel.id == _uuid.UUID(user_id),
                UserModel.is_active == True,
            ).first()
        finally:
            _db.close()
        # Return 401 if no active user was found for this token
        if not current_user:
            raise HTTPException(status_code=401, detail="User not found")

    # Enforce role — Super Admin has no firm and cannot view documents
    allowed = {UserRole.LAWYER, UserRole.ASSOCIATE, UserRole.PARALEGAL}
    if current_user.role not in allowed:
        raise HTTPException(status_code=403, detail="Access denied")

    # Look up the document and confirm it belongs to this user's firm
    repo = DocumentRepository(db)
    doc = repo.get_document(current_user.firm_id, document_id)
    # Return 404 if the document doesn't exist or belongs to a different firm
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Build the path to the PDF file on disk
    file_path = UPLOAD_DIR / doc.stored_filename
    # Return 404 if the file is unexpectedly missing from disk
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on server")

    # Use "attachment" to trigger a save dialog, or "inline" for in-browser viewing
    disposition = "attachment" if download else "inline"
    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        filename=doc.original_filename,
        headers={"Content-Disposition": f'{disposition}; filename="{doc.original_filename}"'},
    )
