FROM python:3.12-slim

WORKDIR /app

# System deps needed for psycopg2, sentence-transformers, PyMuPDF
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Uploads directory (Railway uses ephemeral storage — documents won't survive redeploys;
# swap for a volume mount or S3 in a production-grade setup)
RUN mkdir -p uploads

EXPOSE 8000

# PORT is injected by Railway at runtime; fall back to 8000 for local docker runs
CMD alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
