# chat_history.py — endpoints for persisting and retrieving Research Page history

# Import uuid for parsing IDs in the patch endpoint
import uuid

# Import FastAPI tools for routing, dependency injection, and validation
from fastapi import APIRouter, Depends
# Import Pydantic for request/response shapes
from pydantic import BaseModel
# Import the SQLAlchemy session type
from sqlalchemy.orm import Session

# Import the role-checking dependency
from core.security import require_role
# Import the database session dependency
from db.session import get_db
# Import ORM models
from models.orm import User, UserRole
# Import the repository
from repositories.chat_history_repo import ChatHistoryRepository

# All routes here are prefixed with /chat-history
router = APIRouter(prefix="/chat-history", tags=["chat-history"])


# ── schemas ─────────────────────────────────────────────────────────────────

# Body sent by the frontend when saving a completed search session
class SaveHistoryRequest(BaseModel):
    # The text the user searched for
    query_text:    str
    # Full /search response as a plain dict (null if search failed)
    search_resp:   dict | None = None
    # Full /generate response as a plain dict (null if generation was not run)
    generate_resp: dict | None = None


# Body sent when patching an existing row with the generate response
class PatchGenerateRequest(BaseModel):
    # The ID of the row to update
    record_id:     str
    # The full /generate response dict to store
    generate_resp: dict


# ── routes ───────────────────────────────────────────────────────────────────

# POST /chat-history — save a completed Research Page session
@router.post("", status_code=201)
def save_history(
    body: SaveHistoryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.LAWYER, UserRole.ASSOCIATE, UserRole.PARALEGAL,
    )),
):
    """
    Persist one query session (search + optional generate) for the current user.
    Returns the newly created record's ID so the frontend can patch generate_resp later.
    """
    repo = ChatHistoryRepository(db)
    entry = repo.create(
        firm_id=current_user.firm_id,
        user_id=current_user.id,
        query_text=body.query_text,
        search_resp=body.search_resp,
        generate_resp=body.generate_resp,
    )
    return {"id": str(entry.id)}


# PATCH /chat-history/generate — attach a generate response to an existing row
@router.patch("/generate")
def patch_generate(
    body: PatchGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.LAWYER, UserRole.ASSOCIATE,
        # Paralegal cannot generate — no point patching their records
    )),
):
    """
    Update the generate_resp column on a record that was saved earlier.
    Scoped to current_user so a user cannot overwrite someone else's row.
    """
    repo = ChatHistoryRepository(db)
    repo.set_generate_resp(
        record_id=uuid.UUID(body.record_id),
        user_id=current_user.id,
        generate_resp=body.generate_resp,
    )
    return {"ok": True}


# GET /chat-history — return the last 7 days of history for the current user
@router.get("")
def get_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.LAWYER, UserRole.ASSOCIATE, UserRole.PARALEGAL,
    )),
):
    """
    Return up to 100 history rows from the past 7 days for the current user,
    newest first. Each row includes the full search and generate response blobs.
    """
    repo = ChatHistoryRepository(db)
    rows = repo.get_recent(user_id=current_user.id, days=7, limit=100)
    return rows
