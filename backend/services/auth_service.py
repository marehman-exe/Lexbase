# auth_service.py — authentication business logic

# hashlib for hashing refresh tokens before storage; uuid for token row IDs
import hashlib
import uuid
# datetime utilities for calculating token expiry timestamps
from datetime import datetime, timedelta, timezone

# SQLAlchemy Session type used for all database operations in this module
from sqlalchemy.orm import Session

# Security helpers: password verification, hashing, token creation and decoding
from core.security import (
    verify_password, hash_password,
    create_access_token, create_refresh_token,
    decode_token, REFRESH_TOKEN_EXPIRE_DAYS,
)
# ORM models for refresh token storage and user lookup
from models.orm import RefreshToken, User

# A pre-computed bcrypt hash used as a dummy target when the email does not
# exist.  Running bcrypt on every request — even for unknown users — makes
# response time constant, preventing a timing oracle that reveals whether an
# email is registered.
_DUMMY_HASH = hash_password("dummy-constant-time-guard-value")


# Verify email and password and return the user if credentials are valid
def authenticate_user(db: Session, email: str, password: str) -> User | None:
    """
    Return the User if email + password are valid and account is active.
    Return None for any failure — never reveal which check failed.
    Always runs bcrypt to keep response time constant regardless of whether
    the email exists (prevents timing-based account enumeration).
    """
    # Look up the user row by lowercased email address
    user = db.query(User).filter(User.email == email.lower()).first()

    # Always call verify_password so the bcrypt cost is paid on every request.
    # For missing users we verify against the dummy hash and discard the result.
    target_hash = user.password_hash if user else _DUMMY_HASH
    password_ok = verify_password(password, target_hash)

    # Return None for any failure so the caller cannot distinguish which check failed
    if not user or not password_ok or not user.is_active:
        return None
    return user


# Create a new access and refresh token pair and persist the refresh token
def issue_tokens(db: Session, user: User) -> tuple[str, str]:
    """
    Create and store a new access + refresh token pair.
    Returns (access_token, refresh_token). Refresh token stored hashed.
    """
    # Build the JWT payload from the user's ID, firm, and role
    payload = {
        "user_id": str(user.id),
        "firm_id": str(user.firm_id) if user.firm_id else None,
        "role":    user.role.value,
    }
    # Sign both tokens with the application secret key
    access_token  = create_access_token(payload)
    refresh_token = create_refresh_token(payload)

    # Store only the hash — never the raw refresh token
    token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    # Insert the hashed refresh token row with its expiry timestamp
    db_token = RefreshToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        revoked=False,
    )
    db.add(db_token)

    # Record the login timestamp on the user row for audit purposes
    user.last_login = datetime.now(timezone.utc)
    db.commit()

    return access_token, refresh_token


# Validate an incoming refresh token, revoke it, and issue a fresh pair
def refresh_access_token(db: Session, raw_refresh_token: str) -> tuple[str, str] | None:
    """
    Validate a refresh token and issue a new pair (rotation).
    Returns None if invalid, expired, or revoked.
    """
    try:
        # Decode and verify the JWT signature before checking the database
        payload = decode_token(raw_refresh_token)
    except Exception:
        return None

    # Reject tokens that were not originally created as refresh tokens
    if payload.get("type") != "refresh":
        return None

    # Hash the incoming token to look it up in the stored hashes table
    token_hash = hashlib.sha256(raw_refresh_token.encode()).hexdigest()
    db_token = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash,
        RefreshToken.revoked == False,
    ).first()

    # Return None if the token was not found or has already been revoked
    if not db_token:
        return None
    # Return None if the token's expiry timestamp has passed
    if db_token.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return None

    # Confirm the owning user still exists and is active before rotating
    user = db.query(User).filter(User.id == db_token.user_id, User.is_active == True).first()
    if not user:
        return None

    # Revoke old token before issuing new pair
    db_token.revoked = True
    db.commit()
    # Issue a brand new token pair now that the old one has been revoked
    return issue_tokens(db, user)


# Mark a stored refresh token as revoked so it cannot be used again
def revoke_refresh_token(db: Session, raw_refresh_token: str) -> None:
    """Mark a refresh token as revoked. Called on logout."""
    # Hash the raw token to find its database row
    token_hash = hashlib.sha256(raw_refresh_token.encode()).hexdigest()
    db_token = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash
    ).first()
    # Set the revoked flag to True and persist the change
    if db_token:
        db_token.revoked = True
        db.commit()
