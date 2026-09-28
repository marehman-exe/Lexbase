# search.py — search endpoint: embed query, run hybrid search, apply relevance floor

# Import uuid for converting chunk and document IDs to strings in the response
import uuid
# Import datetime utilities for the query log timestamp
from datetime import datetime, timezone

# Import FastAPI tools for routing, dependency injection, and error responses
from fastapi import APIRouter, Depends, HTTPException
# Import Pydantic for defining request and response data shapes, with field validation
from pydantic import BaseModel, Field
# Import the SQLAlchemy session type for database operations
from sqlalchemy.orm import Session

# Load app settings for relevance floor and minimum query word count
from core.config import settings
# Import the role-checking dependency to restrict access by user role
from core.security import require_role
# Import the database session dependency
from db.session import get_db
# Import ORM models used in the route handler
from models.orm import User, UserRole, QueryLog
# Import the search repository that runs the actual database queries
from repositories.search_repo import SearchRepository
# Import the function that converts a text query into an embedding vector
from services.embedding_service import embed_query
# Import the off-topic guard that rejects queries unrelated to legal content
from services.query_guard import is_off_topic

# Create the search router — all routes here will be prefixed with /search
router = APIRouter(prefix="/search", tags=["search"])

# Hard limits from spec section 8.4 — maximum characters in a search query
_MAX_QUERY_LEN = 500


# ── schemas ─────────────────────────────────────────────────────────────────

# Shape of the JSON body the client sends when making a search request
class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=_MAX_QUERY_LEN)


# Shape of a single search result entry returned to the client
class SearchResult(BaseModel):
    chunk_id:    str
    text:        str
    page_number: int
    document_id: str
    filename:    str
    # Similarity score expressed as 0–100 so it is human-readable
    score:       float   # 0–100, human-meaningful


# Shape of the complete search response returned to the client
class SearchResponse(BaseModel):
    results:      list[SearchResult]
    total:        int
    # True when the relevance floor caused all results to be suppressed
    no_results:   bool   # True when relevance floor caused suppression
    query:        str


# ── route ────────────────────────────────────────────────────────────────────

# Search endpoint — embeds the query, runs hybrid search, filters by relevance, returns top 10
@router.post("", response_model=SearchResponse)
def search(
    body: SearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.LAWYER, UserRole.ASSOCIATE, UserRole.PARALEGAL,
        # SUPER_ADMIN is deliberately excluded — spec: Super Admin cannot query
        # or run searches against any firm's knowledge base.
        # The omission here IS the enforcement point.
    )),
):
    """
    Hybrid search: embed the query, run vector + keyword search, fuse with RRF,
    apply relevance floor, return top 10 results.
    All results are scoped to the current user's firm_id from the JWT.
    """
    # Import time here to measure how long the search takes for the audit log
    import time
    start = time.monotonic()

    # Strip leading/trailing whitespace from the query before processing
    query_text = body.query.strip()

    # Reject queries that are too short to express legal intent.
    if len(query_text.split()) < settings.min_query_words:
        return SearchResponse(
            results=[],
            total=0,
            no_results=True,
            query=query_text,
        )

    # Reject queries that are clearly off-topic (weather, sports, etc.)
    off_topic, _ = is_off_topic(query_text)
    if off_topic:
        return SearchResponse(
            results=[],
            total=0,
            no_results=True,
            query=query_text,
        )

    # Embed the query (WITH the BGE query prefix — see embedding_service.py)
    # This converts the text into a 384-dimensional vector for similarity comparison
    query_vector = embed_query(query_text)

    # Run hybrid search — relevance_floor is passed in so filtering happens
    # inside the repo on every individual result, not just the top one.
    repo = SearchRepository(db)
    raw_results = repo.hybrid_search(
        firm_id=current_user.firm_id,
        query_vector=query_vector,
        query_text=query_text,
        top_n=10,
        relevance_floor=settings.relevance_floor,
    )

    # Record how many milliseconds the search took for the audit log
    latency_ms = int((time.monotonic() - start) * 1000)

    # no_results is True when the repo returned nothing after filtering
    no_results = len(raw_results) == 0

    if no_results:
        results = []
    else:
        # Convert similarity (0–1) to a 0–100 score for display
        results = [
            SearchResult(
                chunk_id=str(r["chunk_id"]),
                text=r["text"],
                page_number=r["page_number"],
                document_id=str(r["document_id"]),
                filename=r["filename"],
                score=round(float(r.get("similarity", 0)) * 100, 1),
            )
            for r in raw_results
        ]

    # Write audit log — always, even on no-results
    top_score = float(raw_results[0].get("similarity", 0.0)) if raw_results else None
    log = QueryLog(
        firm_id=current_user.firm_id,
        user_id=current_user.id,
        query_text=query_text,
        result_count=len(results),
        top_score=top_score,
        generation_ran=False,
        was_refused=no_results,
        refusal_reason="below relevance floor" if no_results else None,
        latency_ms=latency_ms,
    )
    db.add(log)
    db.commit()

    return SearchResponse(
        results=results,
        total=len(results),
        no_results=no_results,
        query=query_text,
    )
