# Entry point — thin on purpose. Real logic lives in services/ and repositories/.

# Import tools for working with file system paths
from pathlib import Path
# Import asyncio for the startup warm-up task
import asyncio
# Import logging to report warm-up results without crashing startup
import logging
# Import FastAPI, the web framework that powers this API server
from fastapi import FastAPI
# Import the lifespan context manager for startup/shutdown hooks
from contextlib import asynccontextmanager
# Import the CORS middleware so browsers on other origins can call this API
from fastapi.middleware.cors import CORSMiddleware
# Import database engine creator and raw SQL text helper
from sqlalchemy import create_engine, text
# Import the rate-limit error handler that sends a 429 response when exceeded
from slowapi import _rate_limit_exceeded_handler
# Import the exception type that slowapi raises when a rate limit is hit
from slowapi.errors import RateLimitExceeded

# Load app-wide settings from the .env file
from core.config import settings
# Load the shared rate limiter instance used by route handlers
from core.limiter import limiter

_log = logging.getLogger(__name__)


async def _warm_ollama() -> None:
    """
    Send a tiny dummy request to Ollama at startup so the model is loaded
    into VRAM before the first real user query arrives.

    Why: Ollama loads the model lazily — the first request after idle pays a
    5–25s cold-load penalty. By warming up during server startup that cost is
    paid once, invisibly, instead of being felt by the first user.

    This runs in the background (asyncio.create_task) so it never delays the
    server becoming ready to serve requests.
    """
    import httpx
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{settings.ollama_base_url.rstrip('/')}/v1/chat/completions",
                json={
                    "model":      settings.ollama_model,
                    "messages":   [{"role": "user", "content": "hi"}],
                    "max_tokens": 1,
                    "keep_alive": "10m",   # keep model warm for 10 min after this call
                },
                timeout=60,
            )
        _log.info("Ollama warm-up complete: %s is loaded in VRAM", settings.ollama_model)
    except Exception as exc:
        # Ollama may not be running — that is fine, Local mode just won't work.
        # Never crash the server because of an optional local provider.
        _log.warning("Ollama warm-up skipped (%s). Start ollama serve to enable Local mode.", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: fire off Ollama warm-up in the background. Shutdown: nothing to do."""
    asyncio.create_task(_warm_ollama())
    yield

# Import each API router so its routes are registered on the main app
from api.auth import router as auth_router
from api.admin import router as admin_router
from api.users import router as users_router
from api.documents import router as documents_router
from api.search import router as search_router
from api.generate import router as generate_router
from api.suggestions import router as suggestions_router
from api.chat_history import router as chat_history_router

# Create the main FastAPI application with a human-readable title and version
app = FastAPI(title="LexBase API", version="0.1.0", lifespan=lifespan)
# Attach the rate limiter so it can track and limit requests app-wide
app.state.limiter = limiter
# Register the handler that returns a 429 error when a rate limit is exceeded
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — origins come from settings so production deployments never need
# to touch source code.  Set ALLOWED_ORIGINS in the environment as a
# comma-separated list, e.g. "https://app.example.com,https://www.example.com".
# Split the comma-separated origins string and strip any extra whitespace
_allowed_origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
# Add the CORS middleware so browsers from allowed origins can talk to the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Register each feature's routes with the main app so they are reachable
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(users_router)
app.include_router(documents_router)
app.include_router(search_router)
app.include_router(generate_router)
app.include_router(suggestions_router)
app.include_router(chat_history_router)

# Created once at startup — manages a connection pool, not per-request.
# Build the database engine using the connection URL from settings
engine = create_engine(settings.database_url)

# Ensure upload directory exists on startup so file saves never fail on a missing folder
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)


# Health check endpoint — lets load balancers and monitoring tools confirm the app is alive
@app.get("/health")
def health_check():
    # Try to run a trivial query to see if the database is reachable
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    # Never expose error detail — it can contain connection strings or internal hostnames.
    # Return a simple status dict showing whether the service and database are healthy
    return {
        "service": "ok" if db_ok else "degraded",
        "database": "reachable" if db_ok else "unreachable",
    }
