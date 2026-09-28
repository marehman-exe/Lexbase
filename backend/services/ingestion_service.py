# ingestion_service.py — PDF validation, storage, parsing, and chunking

# Standard library imports for OS paths, regex, and unique IDs
import os
import re
import uuid
from pathlib import Path

# PyMuPDF for reading and extracting text from PDF files
import fitz          # PyMuPDF
# Tiktoken tokeniser used to count and slice tokens accurately
import tiktoken

# Application settings loaded from the .env configuration file
from core.config import settings
# Factory that opens a new database session independent of the request cycle
from db.session import SessionLocal
# ORM models for documents and their lifecycle status values
from models.orm import Document, DocumentStatus
# Repository layer for all document and chunk database operations
from repositories.document_repo import DocumentRepository

# PDF magic bytes — first 4 bytes of every real PDF file
_PDF_MAGIC = b"%PDF"

# Tokeniser — cl100k_base is a close approximation for chunk-size budgeting
_TOKENISER = tiktoken.get_encoding("cl100k_base")

# Chunk targeting (spec: ~400 tokens, ~60 overlap)
TARGET_TOKENS  = 400
OVERLAP_TOKENS = 60
# Hard token ceiling — no single chunk may exceed this size
MAX_TOKENS     = 480   # hard ceiling — never exceed this per chunk

# Upload directory — resolved once at import time relative to this file
UPLOAD_DIR = Path(__file__).resolve().parent.parent / settings.upload_dir
# Create the upload directory on disk if it does not yet exist
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ── helpers ────────────────────────────────────────────────────────────────

# Count how many tokens a text string contains using the shared tokeniser
def _token_count(text: str) -> int:
    return len(_TOKENISER.encode(text))


# Clean raw PDF page text by fixing hyphens and collapsing whitespace
def _clean_page_text(text: str) -> str:
    """
    Basic cleaning of raw PDF page text:
    - Repair broken hyphenation across line breaks ("admis-\\nsion" → "admission")
    - Normalise whitespace within lines (tabs, multiple spaces → single space)
    - Collapse excessive blank lines
    """
    # Repair soft hyphens that split words across line breaks
    text = re.sub(r"-\s*\n\s*", "", text)        # repair soft hyphens
    # Collapse multiple spaces and tabs into a single space
    text = re.sub(r"[ \t]+", " ", text)           # normalise horizontal whitespace
    # Reduce three or more consecutive blank lines to just two
    text = re.sub(r"\n{3,}", "\n\n", text)        # collapse blank lines
    return text.strip()


# Split cleaned page text into overlapping token-bounded chunks for embedding
def _split_into_chunks(page_texts: list[tuple[int, str]]) -> list[dict]:
    """
    Split a list of (page_number, cleaned_text) pairs into overlapping chunks.

    Strategy (recursive as per spec):
      1. Split on paragraph boundaries (double newline)
      2. If a paragraph still exceeds MAX_TOKENS, split on sentence boundaries
      3. If a sentence still exceeds MAX_TOKENS, split on raw token boundaries

    Each chunk targets ~TARGET_TOKENS tokens with ~OVERLAP_TOKENS of overlap
    carried forward from the previous chunk tail.
    Page number on every chunk = page where that chunk's content starts.

    Returns list of dicts: {chunk_index, page_number, text, token_count}
    """
    # Build a flat list of (page_number, unit_text) atomic pieces
    units: list[tuple[int, str]] = []

    # Iterate every page and break text into paragraph-level atomic units
    for page_num, page_text in page_texts:
        for para in re.split(r"\n\n+", page_text):
            para = para.strip()
            if not para:
                continue
            # Paragraphs within the token limit are kept as one unit
            if _token_count(para) <= MAX_TOKENS:
                units.append((page_num, para))
            else:
                # Split paragraph on sentence boundaries
                sentences = re.split(r"(?<=[.!?])\s+", para)
                buf = ""
                for sent in sentences:
                    candidate = (buf + " " + sent).strip() if buf else sent
                    if _token_count(candidate) <= MAX_TOKENS:
                        buf = candidate
                    else:
                        if buf:
                            units.append((page_num, buf))
                        if _token_count(sent) > MAX_TOKENS:
                            # Split single long sentence on token boundaries
                            tokens = _TOKENISER.encode(sent)
                            for i in range(0, len(tokens), MAX_TOKENS):
                                piece = _TOKENISER.decode(tokens[i:i + MAX_TOKENS])
                                units.append((page_num, piece))
                            buf = ""
                        else:
                            buf = sent
                if buf:
                    units.append((page_num, buf))

    # Slide a window accumulating units up to TARGET_TOKENS, with overlap
    chunks: list[dict] = []
    overlap_text = ""
    chunk_index = 0
    i = 0

    # Walk through atomic units and assemble them into token-bounded chunks
    while i < len(units):
        page_num, unit_text = units[i]
        # Prepend overlap text carried forward from the previous chunk
        current_text = (overlap_text + "\n\n" + unit_text).strip() if overlap_text else unit_text
        current_page = page_num   # chunk page = page where it starts

        # Greedily add more units until we would exceed TARGET_TOKENS
        while i + 1 < len(units):
            _, next_text = units[i + 1]
            candidate = current_text + "\n\n" + next_text
            if _token_count(candidate) > TARGET_TOKENS:
                break
            current_text = candidate
            i += 1

        # Record the assembled chunk with its token count and source page
        tc = _token_count(current_text)
        chunks.append({
            "chunk_index": chunk_index,
            "page_number": current_page,
            "text":        current_text,
            "token_count": tc,
        })
        chunk_index += 1

        # Carry the tail of this chunk forward as overlap for the next
        tokens = _TOKENISER.encode(current_text)
        overlap_text = _TOKENISER.decode(tokens[-OVERLAP_TOKENS:]) if len(tokens) > OVERLAP_TOKENS else current_text

        i += 1

    return chunks


# ── upload validation ──────────────────────────────────────────────────────

# Validate the uploaded file against all rules before accepting it
def validate_upload(filename: str, content: bytes, firm_doc_count: int) -> str | None:
    """
    Run all upload validation rules from spec section 8.3.
    Returns an error string if invalid, None if all checks pass.
    """
    # Only .pdf file extensions are accepted by this system
    if not filename.lower().endswith(".pdf"):
        return "Only PDF files are accepted"

    # Verify the file starts with the PDF magic bytes to confirm its type
    if content[:4] != _PDF_MAGIC:
        return "File does not appear to be a valid PDF (magic bytes mismatch)"

    # Reject files that exceed the configured per-upload size limit
    max_bytes = settings.max_file_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        return f"File exceeds the {settings.max_file_size_mb} MB limit"

    # Reject uploads that would push the firm over its document quota
    if firm_doc_count >= settings.max_docs_per_firm:
        return f"Document limit ({settings.max_docs_per_firm}) reached for this firm"

    return None


# ── file storage ───────────────────────────────────────────────────────────

# Write uploaded PDF bytes to disk with a new UUID as the stored filename
def save_file(content: bytes) -> str:
    """
    Write content to disk under a server-generated UUID filename.
    Returns the UUID filename (not the full path).
    The original filename is never used on disk.
    """
    # Generate a random UUID name so original filenames never touch the filesystem
    stored_name = f"{uuid.uuid4()}.pdf"
    (UPLOAD_DIR / stored_name).write_bytes(content)
    return stored_name


# Remove a previously stored PDF file from the upload directory
def delete_file(stored_filename: str) -> None:
    """Remove the file from disk. Silently ignores missing files."""
    try:
        (UPLOAD_DIR / stored_filename).unlink()
    except FileNotFoundError:
        pass


# ── background ingestion task ──────────────────────────────────────────────

# Full background pipeline: open PDF, extract text, chunk, embed, and store
def run_ingestion(document_id: str) -> None:
    """
    Background task: parse → clean → chunk → batch-insert.
    Opens its own DB session because FastAPI BackgroundTasks runs after
    the request session has been closed.

    Status transitions:
      pending → processing → ready    (success)
      pending → processing → failed   (any unrecoverable error)

    Partial-failure policy: individual pages that raise during extraction
    are skipped and their numbers recorded in error_message. The document
    is marked ready if at least one chunk was produced; failed only when
    zero chunks result or a fatal error occurs before chunking.
    """
    # Open a dedicated DB session for this background task
    db = SessionLocal()
    doc = None
    try:
        repo = DocumentRepository(db)
        # Look up the document row by its ID before doing anything
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            return

        # Transition document status to processing so the UI shows progress
        repo.set_status(doc, DocumentStatus.PROCESSING)
        db.commit()

        # Build the full path to the stored PDF file on disk
        stored_path = UPLOAD_DIR / doc.stored_filename

        # ── open PDF ──────────────────────────────────────────────────────
        try:
            # Attempt to open the PDF; mark failed if the file is unreadable
            pdf = fitz.open(str(stored_path))
        except Exception as e:
            repo.set_status(doc, DocumentStatus.FAILED, error_message=f"Could not open PDF: {e}")
            db.commit()
            return

        # ── encrypted / password-protected check ──────────────────────────
        # Refuse to process password-protected PDFs since text cannot be extracted
        if pdf.is_encrypted:
            pdf.close()
            repo.set_status(doc, DocumentStatus.FAILED,
                            error_message="PDF is password-protected or encrypted")
            db.commit()
            return

        total_pages = pdf.page_count

        # ── page count limit ──────────────────────────────────────────────
        # Reject documents that exceed the per-document page limit from settings
        if total_pages > settings.max_pages_per_doc:
            pdf.close()
            repo.set_status(
                doc, DocumentStatus.FAILED,
                error_message=f"Document has {total_pages} pages; limit is {settings.max_pages_per_doc}",
            )
            db.commit()
            return

        # ── extract text page by page ─────────────────────────────────────
        # Walk every page, extract raw text, clean it, and accumulate results
        page_texts: list[tuple[int, str]] = []
        skipped_pages: list[int] = []
        total_chars = 0

        for page_num in range(total_pages):
            try:
                raw = pdf[page_num].get_text("text")
                total_chars += len(raw)
                cleaned = _clean_page_text(raw)
                # Only keep pages that contain non-empty text after cleaning
                if cleaned:
                    page_texts.append((page_num + 1, cleaned))   # 1-indexed
            except Exception:
                # Record failed pages but continue processing the rest
                skipped_pages.append(page_num + 1)

        pdf.close()

        # ── scanned-PDF detection ─────────────────────────────────────────
        # Fewer than 100 chars total across the whole document = scan
        if total_chars < 100:
            # Mark as failed because scanned PDFs contain no extractable text
            repo.set_status(
                doc, DocumentStatus.FAILED,
                error_message=(
                    "No extractable text found. This appears to be a scanned PDF. "
                    "Only digital-text PDFs are supported."
                ),
            )
            db.commit()
            return

        # ── chunk ─────────────────────────────────────────────────────────
        # Convert cleaned page texts into overlapping token-bounded chunks
        raw_chunks = _split_into_chunks(page_texts)

        # If no chunks were produced then there is nothing to store
        if not raw_chunks:
            repo.set_status(doc, DocumentStatus.FAILED,
                            error_message="No text content could be extracted")
            db.commit()
            return

        # ── embed in batches of 32 ────────────────────────────────────────
        # Import embedding service here to avoid circular import at module level
        from services.embedding_service import embed_passages, MODEL_NAME
        texts = [c["text"] for c in raw_chunks]
        # Generate dense vector embeddings for every chunk text in one batch call
        vectors = embed_passages(texts)

        # ── batch insert — one SQL statement, not N ───────────────────────
        # Build chunk row dicts by merging chunk metadata with their embeddings
        chunk_rows = [
            {
                "firm_id":        doc.firm_id,
                "document_id":    doc.id,
                "embedding":      vectors[i],
                "embedding_model": MODEL_NAME,
                **c,
            }
            for i, c in enumerate(raw_chunks)
        ]
        # Write all chunk rows to the database in a single bulk operation
        repo.insert_chunks_batch(chunk_rows)

        # ── mark ready ────────────────────────────────────────────────────
        # Record any skipped page numbers as a warning on the document row
        warning = f" (pages skipped: {skipped_pages})" if skipped_pages else None
        repo.set_status(doc, DocumentStatus.READY,
                        page_count=total_pages, error_message=warning)
        db.commit()

        # ── generate suggestions (non-fatal — never blocks ingestion) ─────
        # Import suggestion service here to avoid circular import at module level
        from services.suggestion_service import generate_suggestions
        # Extract keyphrase suggestions from the newly indexed chunks
        generate_suggestions(db, doc.id)

    except Exception as e:
        db.rollback()
        if doc is not None:
            try:
                # Attempt to record the error message on the document row
                repo = DocumentRepository(db)
                repo.set_status(doc, DocumentStatus.FAILED, error_message=str(e))
                db.commit()
            except Exception:
                pass
    finally:
        # Always close the dedicated session when the background task finishes
        db.close()
