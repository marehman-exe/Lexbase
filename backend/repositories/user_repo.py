# user_repo.py — all user and firm DB queries; firm_id required on every data method

# uuid for typing all ID parameters throughout this repository
import uuid
# SQLAlchemy Session type used for all database access
from sqlalchemy.orm import Session

# ORM models for firms, users, and the user role enum
from models.orm import Firm, User, UserRole
# BaseRepository provides the shared db session attribute
from repositories.base import BaseRepository


# Repository class for all user and firm database operations
class UserRepository(BaseRepository):

    # ── firm operations ────────────────────────────────────────────────────

    # Insert a new firm row and return it with its generated ID
    def create_firm(self, name: str) -> Firm:
        """Create and return a new firm."""
        # Build the Firm ORM object with a fresh UUID and the provided name
        firm = Firm(id=uuid.uuid4(), name=name)
        self.db.add(firm)
        self.db.flush()   # assigns id without committing
        return firm

    # Return a single firm by its UUID, or None if not found
    def get_firm_by_id(self, firm_id: uuid.UUID) -> Firm | None:
        return self.db.query(Firm).filter(Firm.id == firm_id).first()

    # Return every firm in the system ordered by creation date, newest first
    def list_all_firms(self) -> list[Firm]:
        """Super Admin only — list all firms."""
        return self.db.query(Firm).order_by(Firm.created_at.desc()).all()

    # ── user operations ────────────────────────────────────────────────────

    # Insert a new user row and return it with its generated ID
    def create_user(self, firm_id: uuid.UUID | None, email: str,
                    password_hash: str, role: UserRole) -> User:
        """Create a user in firm_id. None only for Super Admin."""
        # Build the User ORM object; must_change_pw is always True for new accounts
        user = User(
            id=uuid.uuid4(),
            email=email.lower(),
            password_hash=password_hash,
            role=role,
            firm_id=firm_id,
            is_active=True,
            must_change_pw=True,   # initial password — must be changed on first login
        )
        self.db.add(user)
        # Flush to assign the ID without committing the outer transaction
        self.db.flush()
        return user

    # Look up a user by their email address regardless of which firm they belong to
    def get_user_by_email(self, email: str) -> User | None:
        return self.db.query(User).filter(User.email == email.lower()).first()

    # Return a user only if they belong to the specified firm
    def get_user_in_firm(self, firm_id: uuid.UUID, user_id: uuid.UUID) -> User | None:
        """
        Return user only if they belong to firm_id.
        Returns None if user exists but is in a different firm — caller returns 404.
        Tenant isolation: firm_id is always checked.
        """
        # Both conditions must be satisfied to prevent cross-firm user access
        return self.db.query(User).filter(
            User.id == user_id,
            User.firm_id == firm_id,
        ).first()

    # Return all users in a firm ordered by their creation date ascending
    def list_users_in_firm(self, firm_id: uuid.UUID) -> list[User]:
        """All users in firm_id — Super Admin excluded by design (they have no firm)."""
        return (
            self.db.query(User)
            .filter(User.firm_id == firm_id)
            .order_by(User.created_at)
            .all()
        )

    # Count only active Associates and Paralegals toward the team member cap
    def count_active_users_in_firm(self, firm_id: uuid.UUID) -> int:
        """
        Count active team members (Associate + Paralegal only).
        The Lawyer who owns the firm is excluded — the cap applies to members
        they create, not to themselves.
        """
        return (
            self.db.query(User)
            .filter(
                User.firm_id == firm_id,
                User.is_active == True,
                # Only count roles that contribute toward the team size cap
                User.role.in_([UserRole.ASSOCIATE, UserRole.PARALEGAL]),
            )
            .count()
        )

    # Return the Lawyer user who owns a specific firm
    def get_lawyer_of_firm(self, firm_id: uuid.UUID) -> User | None:
        """Return the Lawyer who owns this firm."""
        return self.db.query(User).filter(
            User.firm_id == firm_id,
            User.role == UserRole.LAWYER,
        ).first()

    # Set a user's is_active flag and return the updated user object
    def set_active(self, user: User, active: bool) -> User:
        """Activate or deactivate a user."""
        user.is_active = active
        # Flush the change so it is visible within the current transaction
        self.db.flush()
        return user
