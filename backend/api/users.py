# users.py — Lawyer routes: create/list/deactivate team members

# Import uuid for working with user IDs as UUIDs
import uuid

# Import FastAPI tools for routing, dependency injection, and error responses
from fastapi import APIRouter, Depends, HTTPException, status
# Import Pydantic for defining request and response data shapes
from pydantic import BaseModel, EmailStr
# Import the SQLAlchemy session type for database operations
from sqlalchemy.orm import Session

# Import security helpers to check the current user and enforce the Lawyer role
from core.security import get_current_user, require_role
# Import the database session dependency
from db.session import get_db
# Import the User model and UserRole enum for type hints and role checks
from models.orm import User, UserRole
# Import user service functions that contain the actual business logic
from services.user_service import (
    create_team_member, deactivate_team_member, list_team_members,
)

# Create the users router — all routes here will be prefixed with /users
router = APIRouter(prefix="/users", tags=["users"])


# ── schemas ─────────────────────────────────────────────────────────────────

# Shape of the JSON body sent when the Lawyer creates a new team member
class CreateMemberRequest(BaseModel):
    email: EmailStr
    # Role must be either "associate" or "paralegal" — Lawyers cannot create other Lawyers
    role: str   # "associate" or "paralegal"


# Shape of a user record returned in API responses
class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    role: str
    firm_id: uuid.UUID | None
    is_active: bool

    # Allow this model to be built directly from a SQLAlchemy ORM object
    model_config = {"from_attributes": True}


# Shape returned after successfully creating a new team member
class CreateMemberResponse(BaseModel):
    user: UserOut
    # The generated plain-text password shown once — the Lawyer must share it with the new member
    initial_password: str   # shown once


# ── routes ──────────────────────────────────────────────────────────────────

# Create team member endpoint — Lawyer adds an Associate or Paralegal to their firm
@router.post("/team", response_model=CreateMemberResponse, status_code=201)
def create_member(
    body: CreateMemberRequest,
    db: Session = Depends(get_db),
    # Only Lawyers can create team members — Associates and Paralegals cannot
    current_user: User = Depends(require_role(UserRole.LAWYER)),
):
    """
    Lawyer creates an Associate or Paralegal in their own firm.
    firm_id comes from the JWT — never from the request body.
    Only 'associate' and 'paralegal' are accepted roles; any attempt to create
    a Lawyer or Super Admin is an explicit 403 — not a generic 400.
    """
    # Parse role first so we can give a specific error for forbidden roles
    try:
        # Convert the role string to the UserRole enum — raises ValueError if invalid
        role = UserRole(body.role)
    except ValueError:
        raise HTTPException(status_code=400, detail="role must be 'associate' or 'paralegal'")

    # Explicit 403 — Lawyer creation is exclusively a Super Admin capability
    # Raise 403 instead of 400 to make it clear this action is forbidden, not malformed
    if role not in (UserRole.ASSOCIATE, UserRole.PARALEGAL):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Lawyers can only create Associates or Paralegals",
        )

    try:
        # Create the team member account in the Lawyer's firm with a temporary password
        user, plain_password = create_team_member(
            db,
            firm_id=current_user.firm_id,   # ← from JWT, not from client
            email=body.email,
            role=role,
        )
    except ValueError as e:
        # Return 400 if the email is already in use or another validation fails
        raise HTTPException(status_code=400, detail=str(e))

    return CreateMemberResponse(
        user=UserOut.model_validate(user),
        initial_password=plain_password,
    )


# List team members endpoint — Lawyer retrieves all members of their firm
@router.get("/team", response_model=list[UserOut])
def list_members(
    db: Session = Depends(get_db),
    # Only Lawyers can list their firm's team members
    current_user: User = Depends(require_role(UserRole.LAWYER)),
):
    """List all team members in the Lawyer's firm."""
    # Fetch all users in this Lawyer's firm and convert each to the response shape
    members = list_team_members(db, current_user.firm_id)
    return [UserOut.model_validate(u) for u in members]


# Deactivate team member endpoint — Lawyer removes access for an Associate or Paralegal
@router.patch("/team/{user_id}/deactivate", response_model=UserOut)
def deactivate_member(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    # Only Lawyers can deactivate team members
    current_user: User = Depends(require_role(UserRole.LAWYER)),
):
    """
    Deactivate a team member.
    Returns 404 if user_id is not in this firm — never 403.
    A 403 would confirm the user exists in another firm.
    """
    # Deactivate the user — the service enforces firm_id so cross-firm attempts return None
    user = deactivate_team_member(db, current_user.firm_id, user_id)
    # Return 404 if the user was not found in this firm — don't reveal they exist elsewhere
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut.model_validate(user)
