# Loads all config from .env â€” never hardcode secrets in source code.
# If a required variable is missing, the app refuses to start.

# Import Path to build the absolute path to the .env file reliably
from pathlib import Path
# Import BaseSettings, which reads values from environment variables and .env files
from pydantic_settings import BaseSettings

# Build the absolute path to the .env file sitting one folder above this file
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


# Settings class â€” every field here maps to an environment variable with the same name (uppercase)
class Settings(BaseSettings):
    # Connection string for the PostgreSQL database (required â€” app won't start without it)
    database_url: str
    # Secret key used to sign and verify JWT tokens (required â€” must be kept private)
    secret_key: str
    # Controls whether the app runs in development or production mode
    environment: str = "development"
    # Comma-separated list of allowed CORS origins.
    # Default covers the Vite dev server only.
    # In production set e.g. ALLOWED_ORIGINS=https://app.yourdomain.com
    allowed_origins: str = "http://localhost:5173"
    # Email address for the built-in super admin account (optional, created at startup)
    super_admin_email: str = ""
    # Password for the built-in super admin account (set this in .env, never in code)
    super_admin_password: str = ""

    # M5 â€” document ingestion
    # Directory where uploaded PDF files are stored on disk
    upload_dir: str = "uploads"
    # Maximum allowed file size for uploads, in megabytes
    max_file_size_mb: int = 25
    # Maximum number of pages accepted per uploaded document
    max_pages_per_doc: int = 800
    # Maximum number of documents a single firm can have in total
    max_docs_per_firm: int = 10

    # M6/M7 â€” search
    # Minimum cosine similarity (0â€“1) for a result to be considered relevant.
    # 0.50 means the query must share meaningful semantic content with the chunk.
    # A bare keyword like "Faisalabad" with no legal context scores ~0.45 against
    # constituency-list chunks â€” blocked. A legal question about the same doc
    # scores ~0.65+ â€” passes.
    relevance_floor: float = 0.50

    # Minimum number of words in a query. Rejects single-word / non-question
    # lookups that can keyword-match without any legal intent.
    min_query_words: int = 3

    # M8 â€” generation
    # API key for the Groq LLM service (leave empty to disable Groq)
    groq_api_key: str = ""
    # API key for the OpenRouter LLM fallback service (leave empty to disable)
    openrouter_api_key: str = ""
    # Which LLM provider to use: "groq", "openrouter", or "ollama"
    llm_provider: str = "groq"
    # Groq model ID â€” must match a model your key can actually access.
    # openai/gpt-oss-20b confirmed working on this key. It is a reasoning model
    # (~20 reasoning tokens overhead) so max_tokens must be â‰¥ 200 to get output.
    # qwen/qwen3.8-27b also on this key but frequently over capacity.
    groq_model: str = "openai/gpt-oss-20b"
    # OpenRouter model ID â€” uses the provider/name format.
    # qwen/qwen3.8-27b:free is confirmed free and live on OpenRouter (capacity fallback).
    openrouter_model: str = "qwen/qwen3.8-27b:free"
    # Base URL for a locally-running Ollama server
    ollama_base_url: str = "http://localhost:11434"
    # Model to use when provider is "ollama" â€” must be pulled first: ollama pull llama3.1:8b
    ollama_model: str = "llama3.1:8b"

    # Tell pydantic-settings where to find the .env file to load values from
    class Config:
        env_file = str(_ENV_FILE)


# Create a single shared settings instance that the rest of the app imports
settings = Settings()
