FROM python:3.12-slim

WORKDIR /app

# System deps required by psycopg2-binary and sentence-transformers
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Ensure uploads directory exists
RUN mkdir -p uploads

# PORT is injected by Railway / Render / Fly at runtime.
# The default 8000 matches local development.
EXPOSE 8000

# Run migrations + seed + server on startup.
# Using shell form so ${PORT} variable is expanded by the shell.
CMD alembic upgrade head && python seed.py && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
