# seed.py — creates the Super Admin; safe to run twice

# os and sys used to add the backend directory to the Python import path
import os
import sys
import uuid

# Ensure the backend package root is on sys.path so local imports resolve
sys.path.insert(0, os.path.dirname(__file__))

# passlib CryptContext for bcrypt password hashing without importing core.security
from passlib.context import CryptContext
# SQLAlchemy Session type used for the database insert
from sqlalchemy.orm import Session

# Application settings loaded from the .env file
from core.config import settings
# Database session factory for opening a connection to the database
from db.session import SessionLocal
# ORM User model and the UserRole enum for creating the admin account
from models.orm import User, UserRole

# Password hashing context configured to use bcrypt as the sole scheme
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


# Create the Super Admin user if it does not already exist
def seed() -> None:
    # Read from settings (loaded from .env) rather than raw os.environ
    email = settings.super_admin_email
    password = settings.super_admin_password

    # Abort early with a clear message if the credentials are missing from .env
    if not email or not password:
        raise SystemExit("SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set in .env")

    # Open a database session for the seed operation
    db: Session = SessionLocal()
    try:
        # Check whether the Super Admin email already exists in the users table
        existing = db.query(User).filter(User.email == email.lower()).first()
        if existing:
            # Idempotent — but abort if the existing user is not a Super Admin.
            # This catches the case where the admin email was accidentally used
            # for a Lawyer or other role, which would be a misconfiguration.
            if existing.role != UserRole.SUPER_ADMIN:
                raise SystemExit(
                    f"ERROR: {email} already exists but has role '{existing.role.value}', "
                    f"not 'super_admin'. Fix the email in .env or the database."
                )
            # Super Admin already exists — nothing to do, exit cleanly
            print(f"Super Admin already exists — skipping: {email}")
            return

        # Build the Super Admin user row with no firm affiliation
        admin = User(
            id=uuid.uuid4(),
            email=email.lower(),
            # Hash the password from settings before storing it
            password_hash=_pwd.hash(password),
            role=UserRole.SUPER_ADMIN,
            firm_id=None,   # Super Admin belongs to no firm — never assigned a firm_id
            is_active=True,
            # Super Admin does not need to change password on first login
            must_change_pw=False,
        )
        db.add(admin)
        db.commit()
        print(f"Super Admin created: {email}")
    finally:
        # Always close the database session even if an exception occurred
        db.close()


# Allow running this file directly: python seed.py
if __name__ == "__main__":
    seed()
