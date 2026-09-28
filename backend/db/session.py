# session.py — engine and session factory

# Import the function that creates the database connection engine
from sqlalchemy import create_engine
# Import sessionmaker to create individual database session objects for each request
from sqlalchemy.orm import sessionmaker

# Load app settings to get the database connection URL
from core.config import settings

# Create the database engine — manages the connection pool for the whole application
# pool_pre_ping=True checks that the connection is alive before using it
engine = create_engine(settings.database_url, pool_pre_ping=True)

# Session factory — call SessionLocal() to get a new database session
# autocommit=False means changes only save when you explicitly call db.commit()
# autoflush=False means queries don't automatically flush pending changes first
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


# FastAPI dependency that opens a database session and closes it after the request finishes
def get_db():
    """FastAPI dependency — yields a session and closes it after the request."""
    # Open a new database session for this request
    db = SessionLocal()
    try:
        # Hand the session to the route handler that requested it
        yield db
    finally:
        # Always close the session when the request is done, even if it raised an error
        db.close()
