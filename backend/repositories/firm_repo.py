# firm_repo.py — firm and user queries; all data queries require firm_id

# uuid for typing all ID parameters in this repository
import uuid
# SQLAlchemy Session type used throughout this repository
from sqlalchemy.orm import Session

# ORM models for firms and users
from models.orm import Firm, User
# BaseRepository provides the shared db session attribute
from repositories.base import BaseRepository


# Repository class for firm-level user and firm queries
class FirmRepository(BaseRepository):

    # Return a single firm by its UUID, or None if not found
    def get_firm(self, firm_id: uuid.UUID) -> Firm | None:
        """Return a firm by its id, or None."""
        return self.db.query(Firm).filter(Firm.id == firm_id).first()

    # Return all active users belonging to a specific firm
    def list_users_in_firm(self, firm_id: uuid.UUID) -> list[User]:
        """Return all users belonging to firm_id.
        firm_id is a required positional argument — it cannot be omitted.
        """
        # Filter by both firm and active status so inactive users are excluded
        return (
            self.db.query(User)
            .filter(User.firm_id == firm_id, User.is_active == True)
            .all()
        )
