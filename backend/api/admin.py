# admin.py — Super Admin routes: create Lawyers, list, suspend, reactivate

# Import uuid for working with Lawyer IDs as UUIDs
import uuid

# Import FastAPI tools for routing, dependency injection, and error responses
from fastapi import APIRouter, Depends, HTTPException, status
# Import Pydantic for defining request and response data shapes
from pydantic import BaseModel, EmailStr
# Import the SQLAlchemy session type for database operations
from sqlalchemy.orm import Session

# Import security helpers to check the current user and enforce the Super Admin role
from core.security import get_current_user, require_role
# Import the database session dependency
from db.session import get_db
# Import the User model and UserRole enum for type hints and role checks
from models.orm import User, UserRole
# Import admin service functions that contain the actual business logic
from services.admin_service import create_lawyer, list_lawyers, set_lawyer_active

# Create the admin router — all routes here will be prefixed with /admin
router = APIRouter(prefix="/admin", tags=["admin"])


# ── schemas ────────────────────────────────────────────────────────────────

# Shape of the JSON body sent when the Super Admin creates a new Lawyer account
class CreateLawyerRequest(BaseModel):
    name: str        # firm name
    email: EmailStr


# Shape of a user record returned in API responses
class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    role: str
    firm_id: uuid.UUID | None
    is_active: bool

    # Allow this model to be built directly from a SQLAlchemy ORM object
    model_config = {"from_attributes": True}


# Shape returned after successfully creating a new Lawyer account
class CreateLawyerResponse(BaseModel):
    user: UserOut
    firm_id: uuid.UUID
    # The generated plain-text password shown once — the admin must share it with the Lawyer
    initial_password: str   # shown once — client must display and discard


# ── routes ─────────────────────────────────────────────────────────────────

# Create Lawyer endpoint — Super Admin creates a new Lawyer and their associated firm
@router.post("/lawyers", response_model=CreateLawyerResponse, status_code=201)
def create_lawyer_route(
    body: CreateLawyerRequest,
    db: Session = Depends(get_db),
    # Only Super Admins are allowed to create Lawyer accounts
    _: User = Depends(require_role(UserRole.SUPER_ADMIN)),
):
    """Super Admin creates a Lawyer and their firm."""
    try:
        # Create the firm, user, and a temporary password in one service call
        user, firm, plain_password = create_lawyer(db, body.name, body.email)
    except ValueError as e:
        # Return 400 if the email is already in use or another validation fails
        raise HTTPException(status_code=400, detail=str(e))
    return CreateLawyerResponse(
        user=UserOut.model_validate(user),
        firm_id=firm.id,
        initial_password=plain_password,
    )


# List Lawyers endpoint — Super Admin retrieves all Lawyer accounts in the system
@router.get("/lawyers", response_model=list[UserOut])
def list_lawyers_route(
    db: Session = Depends(get_db),
    # Only Super Admins are allowed to list Lawyer accounts
    _: User = Depends(require_role(UserRole.SUPER_ADMIN)),
):
    """Super Admin lists all Lawyer accounts."""
    # Fetch all Lawyers and convert each one to the UserOut response shape
    return [UserOut.model_validate(u) for u in list_lawyers(db)]


# Suspend Lawyer endpoint — Super Admin deactivates a Lawyer so they cannot log in
@router.patch("/lawyers/{lawyer_id}/suspend", response_model=UserOut)
def suspend_lawyer(
    lawyer_id: uuid.UUID,
    db: Session = Depends(get_db),
    # Only Super Admins are allowed to suspend accounts
    _: User = Depends(require_role(UserRole.SUPER_ADMIN)),
):
    """Suspend a Lawyer account."""
    try:
        # Set the Lawyer's account to inactive so they can no longer log in
        user = set_lawyer_active(db, lawyer_id, active=False)
    except ValueError as e:
        # Return 404 if no Lawyer with this ID exists
        raise HTTPException(status_code=404, detail=str(e))
    return UserOut.model_validate(user)


# Reactivate Lawyer endpoint — Super Admin re-enables a previously suspended Lawyer
@router.patch("/lawyers/{lawyer_id}/reactivate", response_model=UserOut)
def reactivate_lawyer(
    lawyer_id: uuid.UUID,
    db: Session = Depends(get_db),
    # Only Super Admins are allowed to reactivate accounts
    _: User = Depends(require_role(UserRole.SUPER_ADMIN)),
):
    """Reactivate a suspended Lawyer account."""
    try:
        # Set the Lawyer's account back to active so they can log in again
        user = set_lawyer_active(db, lawyer_id, active=True)
    except ValueError as e:
        # Return 404 if no Lawyer with this ID exists
        raise HTTPException(status_code=404, detail=str(e))
    return UserOut.model_validate(user)
