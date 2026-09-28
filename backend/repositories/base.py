# base.py — repository skeleton; firm_id is required on every data-access method

# uuid imported so subclasses can type ID parameters without re-importing
import uuid
# SQLAlchemy Session type that all repositories accept as their sole constructor argument
from sqlalchemy.orm import Session


# Base class that all repository classes must inherit to get a shared db session
class BaseRepository:
    """
    Every repository inherits this.
    The firm_id parameter is non-optional on all methods that touch firm data —
    this is the single choke-point that enforces tenant isolation.
    """

    # Store the database session so all methods in the subclass can use it
    def __init__(self, db: Session) -> None:
        self.db = db
