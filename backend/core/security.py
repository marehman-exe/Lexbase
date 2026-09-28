# security.py — password hashing and JWT primitives
# No business logic here — only the cryptographic operations.

# Import date/time utilities for calculating token expiry times
from datetime import datetime, timedelta, timezone
# Import Any so function signatures can accept dictionaries with mixed value types
from typing import Any

# Import JWT library for encoding and decoding signed tokens
from jose import JWTError, jwt
# Import the password hashing context that handles bcrypt encryption
from passlib.context import CryptContext

# Load app settings so we can read the secret key used to sign tokens
from core.config import settings

# Create the bcrypt password hashing context — handles hashing and verification
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── passwords ──────────────────────────────────────────────────────────────

# Hash the user's plain-text password before storing it in the database
def hash_password(plain: str) -> str:
    """Return bcrypt hash of plain-text password."""
    return _pwd.hash(plain)


# Check whether a plain-text password matches its stored bcrypt hash
def verify_password(plain: str, hashed: str) -> bool:
    """Return True if plain matches the stored hash."""
    return _pwd.verify(plain, hashed)


# ── JWT ────────────────────────────────────────────────────────────────────

# Signing algorithm used for all JWT tokens in this application
_ALGORITHM = "HS256"
# Short-lived access token expires after 15 minutes for security
ACCESS_TOKEN_EXPIRE_MINUTES  = 15
# Longer-lived refresh token lets users stay logged in for 7 days
REFRESH_TOKEN_EXPIRE_DAYS    = 7


# Create a short-lived access token signed with the app secret key
def create_access_token(data: dict[str, Any]) -> str:
    """Issue a signed access token that expires in 15 minutes."""
    # Copy the payload so we don't mutate the caller's dictionary
    payload = data.copy()
    # Set the expiry time 15 minutes from right now
    payload["exp"] = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    # Mark this token as an access token so it can't be used as a refresh token
    payload["type"] = "access"
    return jwt.encode(payload, settings.secret_key, algorithm=_ALGORITHM)


# Create a long-lived refresh token that lets the user get a new access token
def create_refresh_token(data: dict[str, Any]) -> str:
    """Issue a signed refresh token that expires in 7 days."""
    # Copy the payload so we don't mutate the caller's dictionary
    payload = data.copy()
    # Set the expiry time 7 days from right now
    payload["exp"] = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    # Mark this token as a refresh token so it can't be used as an access token
    payload["type"] = "refresh"
    return jwt.encode(payload, settings.secret_key, algorithm=_ALGORITHM)


# Verify a token's signature and expiry, then return the data inside it
def decode_token(token: str) -> dict[str, Any]:
    """
    Verify signature and expiry. Raise JWTError if either fails.
    Returns the decoded payload dict.
    """
    return jwt.decode(token, settings.secret_key, algorithms=[_ALGORITHM])


# ── FastAPI dependencies ───────────────────────────────────────────────────
# Import UUID utilities for converting the user ID string back to a UUID object
import uuid as _uuid
# Import FastAPI dependency injection tools and HTTP error helpers
from fastapi import Depends, HTTPException, status
# Import the OAuth2 bearer token extractor that reads the Authorization header
from fastapi.security import OAuth2PasswordBearer
# Import the SQLAlchemy session type for type hints in dependency functions
from sqlalchemy.orm import Session

# Import the database session dependency so we can look users up in the database
from db.session import get_db
# Import the User model and the UserRole enum for database lookups and role checks
from models.orm import User, UserRole

# tokenUrl must point at the form-encoded endpoint that Swagger UI calls
# when the user clicks Authorize — /auth/login is JSON-only and will 422.
# This scheme extracts the Bearer token from the Authorization request header
_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


# FastAPI dependency that reads the Bearer token and returns the logged-in user
def get_current_user(
    token: str = Depends(_oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency — resolves the current user from the Bearer token.
    Raises 401 for any token problem. Raises 403 for inactive accounts.
    """
    # Prepare a generic 401 error to return for any token-related failure
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    # Decode the token and check it is the right type and contains a user ID
    try:
        payload = decode_token(token)
        # Reject refresh tokens being used where an access token is required
        if payload.get("type") != "access":
            raise credentials_exc
        user_id = payload.get("user_id")
        # Reject tokens that contain no user identifier
        if not user_id:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    # Look up the user in the database by their UUID
    user = db.query(User).filter(User.id == _uuid.UUID(user_id)).first()
    # Return 401 if no matching user exists in the database
    if not user:
        raise credentials_exc
    # Return 403 if the account has been deactivated by an admin
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account inactive")
    return user


# Like get_current_user but does not raise an error — returns None if no valid token
def get_current_user_optional(
    token: str = Depends(OAuth2PasswordBearer(tokenUrl="/auth/token", auto_error=False)),
    db: Session = Depends(get_db),
) -> User | None:
    """
    Like get_current_user but returns None instead of raising 401.
    Used by endpoints that accept both header auth and query-param token (e.g. PDF viewer).
    """
    # Return None immediately if no token was provided at all
    if not token:
        return None
    # Try to decode and validate the token; return None for any failure instead of raising
    try:
        payload = decode_token(token)
        # Reject refresh tokens used in place of access tokens
        if payload.get("type") != "access":
            return None
        user_id = payload.get("user_id")
        # Return None if the token has no user identifier
        if not user_id:
            return None
        # Look up the user and return None if they don't exist or are deactivated
        user = db.query(User).filter(User.id == _uuid.UUID(user_id)).first()
        if not user or not user.is_active:
            return None
        return user
    except JWTError:
        return None


# Factory that returns a dependency enforcing that the user has one of the given roles
def require_role(*roles: UserRole):
    """
    Returns a dependency that enforces one of the given roles.
    Usage: Depends(require_role(UserRole.LAWYER, UserRole.SUPER_ADMIN))
    """
    # Inner dependency function that checks the current user's role
    def _check(current_user: User = Depends(get_current_user)) -> User:
        # Raise 403 if the user's role is not in the allowed list
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user
    return _check
