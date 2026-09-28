# env.py — Alembic migration environment; connects ORM metadata to the database.
# Alembic reads this file to know which models to inspect and which URL to connect to.

# fileConfig wires Alembic's INI log settings into Python's logging system
from logging.config import fileConfig

# engine_from_config builds a SQLAlchemy engine from the alembic.ini [alembic] section
from sqlalchemy import engine_from_config
# pool.NullPool prevents connection pooling in migration scripts (single-use connections)
from sqlalchemy import pool

# context is the Alembic runtime object that drives migration execution
from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata

# Add the backend directory to sys.path so imports like core.config work here
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))  # adds backend/ to path

# Application settings loaded from .env, used to supply the database URL
from core.config import settings
# Import the ORM Base so Alembic can compare model metadata against the live schema
from models.orm import Base

# Override the SQLAlchemy URL in the alembic.ini with the value from settings
config.set_main_option("sqlalchemy.url", settings.database_url)
# Tell Alembic which metadata to compare against when generating migrations
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


# Run migrations without a live database connection using SQL scripts
def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    # Retrieve the database URL from the Alembic config for offline use
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    # Begin a transaction and run all pending migrations against the URL
    with context.begin_transaction():
        context.run_migrations()


# Run migrations with a live database connection established by the engine
def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    # Build the SQLAlchemy engine from the alembic.ini sqlalchemy.* settings
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    # Open a real database connection and run all pending migrations
    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        # Wrap the migrations in a transaction so failures roll back cleanly
        with context.begin_transaction():
            context.run_migrations()


# Choose offline or online mode based on how Alembic was invoked
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
