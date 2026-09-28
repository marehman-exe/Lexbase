# admin_service.py — Super Admin operations: create Lawyers, suspend/reactivate

# secrets for cryptographically safe password generation; string for character sets
import secrets
import string
# uuid for typing the lawyer_id parameter
import uuid

# SQLAlchemy Session type used for all database operations in this module
from sqlalchemy.orm import Session

# Password hashing utility for storing new passwords securely
from core.security import hash_password
# ORM models for firms, users, and their role values
from models.orm import Firm, User, UserRole
# Repository layer for all user and firm database operations
from repositories.user_repo import UserRepository


# Generate a random initial password for a new Lawyer or team member account
def _generate_password(length: int = 16) -> str:
    """Generate a cryptographically random initial password."""
    # Build the character pool from letters, digits, and a few special characters
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    # Pick `length` random characters from the pool using a secure random source
    return ''.join(secrets.choice(alphabet) for _ in range(length))


# Create a new Firm and its owning Lawyer user in a single transaction
def create_lawyer(db: Session, name: str, email: str) -> tuple[User, Firm, str]:
    """
    Create a Firm and its owning Lawyer in one transaction.
    Returns (user, firm, plain_password) — password shown once, never stored plain.
    Raises ValueError if email already exists.
    """
    repo = UserRepository(db)

    # Reject the request if this email is already registered in the system
    if repo.get_user_by_email(email):
        raise ValueError(f"Email already registered: {email}")

    # Generate the random initial password shown to the Super Admin once
    plain_password = _generate_password()
    # Create the firm row first so the user can reference it via foreign key
    firm = repo.create_firm(name=name)
    # Create the Lawyer user and link them to the newly created firm
    user = repo.create_user(
        firm_id=firm.id,
        email=email,
        password_hash=hash_password(plain_password),
        role=UserRole.LAWYER,
    )
    # Commit both rows in one transaction to avoid leaving orphaned records
    db.commit()
    db.refresh(user)
    db.refresh(firm)
    return user, firm, plain_password


# Return all Lawyer accounts ordered from newest to oldest
def list_lawyers(db: Session) -> list[User]:
    """Return all Lawyer accounts."""
    return (
        db.query(User)
        .filter(User.role == UserRole.LAWYER)
        .order_by(User.created_at.desc())
        .all()
    )


# Activate or suspend a specific Lawyer account by its ID
def set_lawyer_active(db: Session, lawyer_id: uuid.UUID, active: bool) -> User:
    """
    Suspend or reactivate a Lawyer account (and implicitly their whole firm).
    Raises ValueError if user not found or is not a Lawyer.
    """
    # Look up the user and confirm they hold the Lawyer role
    user = db.query(User).filter(
        User.id == lawyer_id,
        User.role == UserRole.LAWYER,
    ).first()
    # Raise a clear error rather than silently doing nothing for unknown IDs
    if not user:
        raise ValueError("Lawyer not found")
    repo = UserRepository(db)
    # Update the is_active flag on the user row via the repository
    repo.set_active(user, active)
    db.commit()
    db.refresh(user)
    return user
