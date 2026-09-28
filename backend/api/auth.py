# auth.py — login, refresh, logout, change-password routes

# Import FastAPI tools for routing, dependency injection, error responses, and request objects
from fastapi import APIRouter, Depends, HTTPException, Request, status
# Import the OAuth2 form handler used by Swagger UI's built-in Authorize button
from fastapi.security import OAuth2PasswordRequestForm
# Import Pydantic for validating request and response data shapes
from pydantic import BaseModel, EmailStr
# Import the SQLAlchemy session type for database operations
from sqlalchemy.orm import Session

# Import security helpers for checking the current user and hashing passwords
from core.security import get_current_user, hash_password
# Import the database session dependency
from db.session import get_db
# Import the User ORM model
from models.orm import User
# Import all authentication service functions used by the route handlers
from services.auth_service import (
    authenticate_user, issue_tokens,
    refresh_access_token, revoke_refresh_token,
)

# Import the shared rate limiter to protect login endpoints from brute-force attacks
from core.limiter import limiter

# Create the auth router — all routes here will be prefixed with /auth
router = APIRouter(prefix="/auth", tags=["auth"])


# ── request / response schemas ─────────────────────────────────────────────

# Shape of the JSON body sent when a user tries to log in
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# Shape of the JSON body returned after a successful login or token refresh
class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    # True if the user must change their password before doing anything else
    must_change_pw: bool = False


# Shape of the JSON body sent when asking for a new access token
class RefreshRequest(BaseModel):
    refresh_token: str


# Shape of the JSON body sent when the user wants to log out
class LogoutRequest(BaseModel):
    refresh_token: str


# Shape of the JSON body sent when the user wants to change their password
class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# ── routes ─────────────────────────────────────────────────────────────────

# Login endpoint — accepts email and password, returns an access and refresh token pair
@router.post("/login", response_model=TokenResponse)
# Rate-limit to 10 attempts per minute per IP to stop brute-force password guessing
@limiter.limit("10/minute")
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate and return token pair. Generic error message always.
    Rate-limited: 10 attempts per minute per IP to prevent brute-force.
    """
    # Check the email and password against the database
    user = authenticate_user(db, body.email, body.password)
    if not user:
        # Never reveal whether the email exists or the password was wrong
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    # Create and store both tokens, then return them to the client
    access_token, refresh_token = issue_tokens(db, user)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        must_change_pw=user.must_change_pw,
    )


# Swagger UI login endpoint — accepts form-encoded username/password instead of JSON
@router.post("/token", response_model=TokenResponse, include_in_schema=False)
def login_form(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    OAuth2 form-encoded login — used exclusively by Swagger UI's Authorize button.
    Accepts username/password as form fields (OAuth2 spec requires 'username').
    The frontend uses POST /auth/login (JSON) instead.
    Hidden from the public schema (include_in_schema=False).
    """
    # Authenticate using the form's username field (which holds the email address)
    user = authenticate_user(db, form.username, form.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    # Create and store both tokens, then return them to Swagger UI
    access_token, refresh_token = issue_tokens(db, user)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        must_change_pw=user.must_change_pw,
    )


# Token refresh endpoint — exchanges a valid refresh token for a brand new token pair
@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    """Exchange a valid refresh token for a new token pair."""
    result = refresh_access_token(db, body.refresh_token)
    # Return 401 if the refresh token is missing, expired, or already revoked
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    access_token, refresh_token = result
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


# Logout endpoint — invalidates the refresh token so it can never be reused
@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(body: LogoutRequest, db: Session = Depends(get_db)):
    """Revoke the refresh token. Always returns 204 — no information leak."""
    revoke_refresh_token(db, body.refresh_token)


# Helper that checks whether a proposed password meets the security policy
def _validate_password_strength(password: str) -> str | None:
    """
    Returns an error message string if the password fails policy, else None.
    Policy: ≥8 chars, at least one uppercase letter, one lowercase letter,
    one digit, and one special character.
    """
    # Import regex module for pattern matching against the password string
    import re
    # Reject passwords shorter than the minimum required length
    if len(password) < 8:
        return "Password must be at least 8 characters"
    # Reject passwords that contain no uppercase letters
    if not re.search(r"[A-Z]", password):
        return "Password must contain at least one uppercase letter"
    # Reject passwords that contain no lowercase letters
    if not re.search(r"[a-z]", password):
        return "Password must contain at least one lowercase letter"
    # Reject passwords that contain no digits
    if not re.search(r"\d", password):
        return "Password must contain at least one number"
    # Reject passwords that contain no special characters
    if not re.search(r"[^A-Za-z0-9]", password):
        return "Password must contain at least one special character"
    # Password passed all checks — return None to signal success
    return None


# Change password endpoint — lets the logged-in user update their own password
@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    body: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Change own password. Clears must_change_pw flag on success.
    Required on first login when the account was created by an admin.
    """
    # Import password verification helper here to avoid circular imports at module level
    from core.security import verify_password
    # Reject the request if the supplied current password does not match the stored hash
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    # Check that the new password meets the strength requirements
    err = _validate_password_strength(body.new_password)
    if err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)
    # Reject if the new password is identical to the current one — that is not a change
    if body.new_password == body.current_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must differ from current password",
        )
    # Hash and save the new password, then clear the forced-change flag
    current_user.password_hash = hash_password(body.new_password)
    current_user.must_change_pw = False
    db.commit()
