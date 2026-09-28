# user_service.py — Lawyer operations: create/deactivate team members

# uuid for typing firm and user ID parameters
import uuid

# SQLAlchemy Session type for all database operations
from sqlalchemy.orm import Session

# Password hashing utility used when creating new team member accounts
from core.security import hash_password
# ORM models for users and their role enum values
from models.orm import User, UserRole
# Repository layer for user and firm database queries
from repositories.user_repo import UserRepository
# Password generator shared with the admin service
from services.admin_service import _generate_password

# Hard limit from spec — enforced here, not just documented
MAX_TEAM_MEMBERS = 10   # hard limit from spec — enforced here, not just documented


# Create a new Associate or Paralegal user within the calling Lawyer's firm
def create_team_member(
    db: Session,
    firm_id: uuid.UUID,
    email: str,
    role: UserRole,
) -> tuple[User, str]:
    """
    Create an Associate or Paralegal in firm_id.
    firm_id comes from the verified JWT — never from the client request body.
    Returns (user, plain_password).
    Raises ValueError on duplicate email or team cap exceeded.
    """
    # Only Associates and Paralegals may be created by a Lawyer through this endpoint
    if role not in (UserRole.ASSOCIATE, UserRole.PARALEGAL):
        raise ValueError("Lawyers can only create Associates or Paralegals")

    repo = UserRepository(db)

    # Reject the request if the email address is already registered in the system
    if repo.get_user_by_email(email):
        raise ValueError(f"Email already registered: {email}")

    # Enforce the 10-member cap — reject before creating
    count = repo.count_active_users_in_firm(firm_id)
    if count >= MAX_TEAM_MEMBERS:
        raise ValueError(f"Team member limit ({MAX_TEAM_MEMBERS}) reached")

    # Generate a random initial password that the new user must change on first login
    plain_password = _generate_password()
    user = repo.create_user(
        firm_id=firm_id,
        email=email,
        password_hash=hash_password(plain_password),
        role=role,
    )
    # Commit the new user to the database and refresh the ORM object
    db.commit()
    db.refresh(user)
    return user, plain_password


# Deactivate an existing team member within the calling Lawyer's firm
def deactivate_team_member(
    db: Session,
    firm_id: uuid.UUID,
    user_id: uuid.UUID,
) -> User:
    """
    Deactivate a team member.
    firm_id comes from the JWT — ensures a Lawyer can only affect their own firm.
    Returns 404-equivalent (None) if user is not in firm_id.
    """
    repo = UserRepository(db)
    # Look up the user and confirm they belong to the calling Lawyer's firm
    user = repo.get_user_in_firm(firm_id, user_id)
    if not user:
        return None   # caller raises 404 — never 403, never "you lack permission"
    # Prevent deactivating the Lawyer who owns the firm through this endpoint
    if user.role == UserRole.LAWYER:
        raise ValueError("Cannot deactivate the firm's Lawyer through this endpoint")
    # Set the user's is_active flag to False in the database
    repo.set_active(user, False)
    db.commit()
    db.refresh(user)
    return user


# Return all users belonging to the given firm for team management display
def list_team_members(db: Session, firm_id: uuid.UUID) -> list[User]:
    """All users in this firm. firm_id from JWT — never from request."""
    repo = UserRepository(db)
    return repo.list_users_in_firm(firm_id)
