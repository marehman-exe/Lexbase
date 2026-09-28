# suggestions.py — GET /suggestions: return keyphrases for the current firm

# Import FastAPI tools for routing and dependency injection
from fastapi import APIRouter, Depends
# Import Pydantic for defining the response data shape
from pydantic import BaseModel
# Import the SQLAlchemy session type for database operations
from sqlalchemy.orm import Session

# Import the role-checking dependency to restrict access by user role
from core.security import require_role
# Import the database session dependency
from db.session import get_db
# Import ORM models used in the query and role check
from models.orm import User, UserRole, SuggestedQuery

# Create the suggestions router — all routes here will be prefixed with /suggestions
router = APIRouter(prefix="/suggestions", tags=["suggestions"])

# Maximum number of suggestion chips returned to the client in one request
_MAX_RESULTS = 12


# Shape of a single suggestion item returned in the response list
class SuggestionOut(BaseModel):
    query_text: str


# Suggestions endpoint — returns up to 12 recent keyphrases from the firm's indexed documents
@router.get("", response_model=list[SuggestionOut])
def get_suggestions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.LAWYER, UserRole.ASSOCIATE, UserRole.PARALEGAL,
        # SUPER_ADMIN excluded — no firm, no knowledge base
    )),
):
    """
    Return up to 12 distinct keyphrases extracted from this firm's indexed
    documents.  Results are ordered by recency (newest document first) so
    that chips stay fresh as new documents are added.
    Scoped strictly to the current user's firm_id from the JWT.

    Guard-rail filtering is applied at read time so that any phrases stored
    before MIN_WORDS was raised to 3 are silently excluded (not deleted —
    deletion happens lazily on the next re-ingestion of each document).
    """
    # Import the off-topic guard here to filter out irrelevant suggestions at read time
    from services.query_guard import is_off_topic

    # Fetch more rows than needed so filtering still leaves enough valid suggestions
    rows = (
        db.query(SuggestedQuery.query_text)
        .filter(SuggestedQuery.firm_id == current_user.firm_id)
        .order_by(SuggestedQuery.created_at.desc())
        .limit(_MAX_RESULTS * 4)   # fetch extra so filtering still gives enough
        .all()
    )

    # Deduplicate while preserving order (case-insensitive).
    # Also filter out phrases that would fail the search guard:
    #   • fewer than 3 words  → "Query too short"
    #   • off-topic domain    → search returns no_results immediately
    # Track which phrases we have already added (lowercased) to avoid duplicates
    seen: set[str] = set()
    result: list[SuggestionOut] = []
    for (text,) in rows:
        # Stop once we have collected enough suggestions to show
        if len(result) >= _MAX_RESULTS:
            break
        # Skip phrases that are too short to pass the search guard
        words = text.strip().split()
        if len(words) < 3:
            continue
        # Skip phrases that the off-topic guard would reject at search time
        off_topic, _ = is_off_topic(text)
        if off_topic:
            continue
        # Skip duplicate phrases that already appear in the result list
        key = text.lower()
        if key not in seen:
            seen.add(key)
            result.append(SuggestionOut(query_text=text))
    return result
