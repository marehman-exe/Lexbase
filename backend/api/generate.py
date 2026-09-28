# generate.py — POST /generate: role-checked, grounded generation endpoint

# Import FastAPI tools for routing, dependency injection, and error responses
from fastapi import APIRouter, Depends, HTTPException
# Import Pydantic for defining the request and response data shapes with field validation
from pydantic import BaseModel, Field
# Import the SQLAlchemy session type for database operations
from sqlalchemy.orm import Session

# Load app settings for relevance floor and minimum query word count
from core.config import settings
# Import the role-checking dependency to restrict access by user role
from core.security import require_role
# Import the database session dependency
from db.session import get_db
# Import ORM models used in the route handler and audit logging
from models.orm import User, UserRole, QueryLog
# Import the search repository that runs the hybrid search queries
from repositories.search_repo import SearchRepository
# Import the function that converts a text query into an embedding vector
from services.embedding_service import embed_query
# Import the generation service that calls the LLM and validates the answer
from services.generation_service import generate_answer
# Import the provider factory — accepts an optional per-request override
from core.providers import get_llm_provider
# Import the off-topic guard that rejects queries unrelated to legal content
from services.query_guard import is_off_topic

# Create the generate router — all routes here will be prefixed with /generate
router = APIRouter(prefix="/generate", tags=["generate"])

# Maximum number of characters allowed in a generation query
_MAX_QUERY_LEN = 500

# Disclaimer text appended to every AI-generated answer to prevent over-reliance
DISCLAIMER = (
    "⚠️ This summary is a research aid generated from your uploaded documents. "
    "It is not legal advice. Verify all citations before relying on this output."
)


# Shape of the JSON body the client sends when requesting an AI-generated answer
class GenerateRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=_MAX_QUERY_LEN)
    # Optional per-request provider override from the frontend toggle.
    # "online" maps to the .env default (groq/openrouter); "local" maps to ollama.
    # Any other value that matches a real provider name (groq/openrouter/ollama) also works.
    provider: str | None = None


# Shape of the JSON response returned after generation (or a refusal)
class GenerateResponse(BaseModel):
    # The AI-generated answer text, or None if generation was refused or failed
    answer:       str | None
    # True if the query was rejected before reaching the LLM
    refused:      bool
    # True if the LLM call failed and only the passages are being returned
    fallback:     bool
    # Legal disclaimer always included regardless of whether an answer was produced
    disclaimer:   str
    # The text passages retrieved from the knowledge base that grounded the answer
    passages:     list[dict]
    # Which provider actually ran (e.g. "groq", "ollama") — shown in the UI
    provider_used: str = ""


# Generate endpoint — searches, filters by relevance, calls the LLM, returns grounded answer
@router.post("", response_model=GenerateResponse)
async def generate(
    body: GenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.LAWYER, UserRole.ASSOCIATE,
        # Paralegal intentionally excluded — spec section 3.1: Paralegals can
        # search but cannot generate summaries.
        # SUPER_ADMIN intentionally excluded — spec: Super Admin cannot query
        # or run searches against any firm's knowledge base.
    )),
):
    """
    Embed query → hybrid search → generate grounded answer → validate citations.
    Async so the event loop is not blocked during the LLM call.
    Paralegal is refused at the dependency level (require_role raises 403).
    LLM failure degrades gracefully — passages are still returned.
    """
    # Strip leading/trailing whitespace from the query before processing
    query_text = body.query.strip()

    # Reject queries that are too short to express legal intent — same guard as /search.
    if len(query_text.split()) < settings.min_query_words:
        return GenerateResponse(
            answer=None,
            refused=True,
            fallback=False,
            disclaimer=DISCLAIMER,
            passages=[],
        )

    # Reject queries that are clearly off-topic (weather, sports, etc.)
    off_topic, _ = is_off_topic(query_text)
    if off_topic:
        return GenerateResponse(
            answer=None,
            refused=True,
            fallback=False,
            disclaimer=DISCLAIMER,
            passages=[],
        )

    # Convert the query text into a vector embedding for semantic search
    query_vector = embed_query(query_text)
    # Run hybrid search — relevance_floor passed in so every result is individually
    # filtered; only passages that actually meet the threshold reach the LLM.
    repo = SearchRepository(db)
    raw_results = repo.hybrid_search(
        firm_id=current_user.firm_id,
        query_vector=query_vector,
        query_text=query_text,
        top_n=10,
        relevance_floor=settings.relevance_floor,
    )

    # No results after filtering means either no documents or nothing relevant
    if not raw_results:
        log = QueryLog(
            firm_id=current_user.firm_id,
            user_id=current_user.id,
            query_text=query_text,
            result_count=0,
            top_score=None,
            generation_ran=False,
            was_refused=True,
            refusal_reason="no passages above relevance floor",
            latency_ms=0,
        )
        db.add(log)
        db.commit()
        return GenerateResponse(
            answer=None,
            refused=True,
            fallback=False,
            disclaimer=DISCLAIMER,
            passages=[],
        )

    # Build a clean list of passage dicts from the raw search results for the LLM
    passages = [
        {
            "text":        r["text"],
            "filename":    r["filename"],
            "page_number": r["page_number"],
            "document_id": str(r["document_id"]),
            "chunk_id":    str(r["chunk_id"]),
        }
        for r in raw_results
    ]

    # Resolve which provider to use.
    # Frontend sends "online" or "local" from the toggle; map those to real names.
    # Any explicit provider name (groq/openrouter/ollama) is passed through as-is.
    _provider_hint = (body.provider or "").lower().strip()
    if _provider_hint == "online":
        resolved_provider = settings.llm_provider   # use whatever .env says
    elif _provider_hint == "local":
        resolved_provider = "ollama"
    elif _provider_hint in ("groq", "openrouter", "ollama"):
        resolved_provider = _provider_hint
    else:
        resolved_provider = None  # let the factory use .env default

    # Call the LLM to generate a grounded answer based on the retrieved passages.
    # Await the async call — the event loop stays free while the model generates.
    # Catch "not reachable" errors (Ollama not running) and degrade gracefully.
    try:
        result = await generate_answer(query_text, passages, provider_override=resolved_provider)
    except RuntimeError as exc:
        err_str = str(exc)
        if "not reachable" in err_str:
            # Provider is unreachable — tell the frontend which one failed
            _which = "Local (Ollama)" if resolved_provider == "ollama" else "Online"
            _other = "Online provider" if resolved_provider == "ollama" else "Local (Ollama)"
            return GenerateResponse(
                answer=None,
                refused=False,
                fallback=True,
                disclaimer=(
                    f"⚠️ {_which} provider is not available right now. "
                    f"{_other} may still work — try switching the toggle."
                ),
                passages=passages,
                provider_used=resolved_provider or settings.llm_provider,
            )
        raise   # re-raise unexpected errors

    # Audit log — record whether generation succeeded, was refused, or fell back
    log = QueryLog(
        firm_id=current_user.firm_id,
        user_id=current_user.id,
        query_text=query_text,
        result_count=len(passages),
        top_score=float(raw_results[0].get("similarity", 0)) if raw_results else None,
        generation_ran=True,
        was_refused=result["refused"],
        refusal_reason=result.get("error") if (result["refused"] or result["fallback"]) else None,
        latency_ms=0,
    )
    db.add(log)
    db.commit()

    return GenerateResponse(
        answer=result["answer"],
        refused=result["refused"],
        fallback=result["fallback"],
        disclaimer=DISCLAIMER,
        passages=passages,
        provider_used=resolved_provider or settings.llm_provider,
    )
