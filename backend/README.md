# LexBase — Backend

> Private legal knowledge assistant — FastAPI backend for the LexBase RAG system.  
> Built at ILMOTECH as part of the engineering training programme.

---

## What is LexBase?

LexBase is a multi-tenant RAG (Retrieval-Augmented Generation) application for law firms. Each firm maintains an isolated knowledge base of indexed PDF documents. Users query the knowledge base via hybrid search (vector + keyword) and optionally generate grounded AI summaries with source citations — all without sending client data to external embedding services.

---

## Repositories

| Repository | Description |
|---|---|
| [LAWYER-RAG-SYSTEM-BE](https://github.com/marehman-exe/Lexbase) | FastAPI backend — ingestion, embeddings, hybrid search, LLM generation |
| [LAWYER-RAG-SYSTEM-FE](https://github.com/marehman-exe/Lexbase) | React 19 frontend — role-aware SPA with JWT auth |

---

## System Architecture

```
Browser (React 19 + Vite + TypeScript + Tailwind CSS 4)
    │
    │  HTTPS / JSON   (Axios + TanStack React Query)
    ▼
FastAPI (Python 3.12)  ←  uvicorn
    │
    ├── /auth          JWT issue, refresh, revoke, change-password
    ├── /admin         Super Admin: create lawyers and firms
    ├── /users         Lawyer: create/deactivate associates and paralegals
    ├── /documents     Upload (Lawyer), list/view/download (all roles), delete (Lawyer)
    ├── /search        Hybrid search (all firm roles)
    ├── /generate      LLM generation (Lawyer + Associate only)
    └── /suggestions   Document-aware query chips (all firm roles)
         │
         ├── PostgreSQL 16 + pgvector
         │     ├── firms, users, refresh_tokens
         │     ├── documents, chunks (vector + tsvector)
         │     ├── query_logs
         │     └── suggested_queries
         │
         ├── Local disk  (uploads/)
         ├── sentence-transformers  (BAAI/bge-small-en-v1.5 — local, zero API cost)
         └── Groq API  (qwen/qwen3.8-27b or llama-3.3-70b-versatile)
```

---

## Tech Stack

| Layer | Technology | Detail |
|---|---|---|
| Backend | FastAPI | Python 3.12 · uvicorn |
| Database | PostgreSQL 16 + pgvector | HNSW vector index · GIN full-text index |
| ORM | SQLAlchemy 2.0 + Alembic | Typed mapped_column API |
| Embedding | BAAI/bge-small-en-v1.5 | 384 dims · local · zero API cost |
| Search | Hybrid RRF | Vector cosine + tsvector keyword fusion |
| LLM | Groq API | qwen/qwen3.8-27b · temperature 0.1 · 2048 max tokens |
| PDF Extraction | PyMuPDF (fitz) | Page-level text extraction |
| Chunking | tiktoken cl100k_base | 400T target · 60T overlap · recursive |
| Suggestions | scikit-learn TF-IDF | ngram (1,3) · zero LLM cost |
| Rate Limiting | slowapi | Per-IP · login 10/min · search 30/min |

---

## API Endpoints

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `POST` | `/auth/login` | Public | Email + password → token pair |
| `POST` | `/auth/refresh` | Public | Rotate refresh token → new pair |
| `POST` | `/auth/logout` | Authenticated | Revoke refresh token |
| `POST` | `/auth/change-password` | Authenticated | Change own password |
| `POST` | `/admin/lawyers` | Super Admin | Create lawyer + firm |
| `GET` | `/admin/lawyers` | Super Admin | List all lawyers |
| `PATCH` | `/admin/lawyers/{id}/suspend` | Super Admin | Suspend a lawyer |
| `PATCH` | `/admin/lawyers/{id}/reactivate` | Super Admin | Reactivate a lawyer |
| `GET` | `/users` | Lawyer | List own firm's team |
| `POST` | `/users` | Lawyer | Create associate/paralegal |
| `PATCH` | `/users/{id}/deactivate` | Lawyer | Deactivate team member |
| `POST` | `/documents` | Lawyer | Upload PDF (202, background ingestion) |
| `GET` | `/documents` | Firm roles | List firm's documents |
| `GET` | `/documents/{id}` | Firm roles | Get document detail |
| `DELETE` | `/documents/{id}` | Lawyer | Delete document + chunks + file |
| `GET` | `/documents/{id}/file` | Firm roles | Stream PDF (inline view or `?download=true`) |
| `POST` | `/search` | Firm roles | Hybrid vector + keyword search |
| `POST` | `/generate` | Lawyer + Associate | LLM-grounded answer with citations |
| `GET` | `/suggestions` | Firm roles | Query suggestion chips |
| `POST` | `/chat-history` | Firm roles | Save a Research Page search session |
| `PATCH` | `/chat-history/generate` | Lawyer + Associate | Attach AI answer to a saved session |
| `GET` | `/chat-history` | Firm roles | Retrieve last 7 days of sessions |
| `GET` | `/health` | Public | Service + database health check |

---

## Role Model

| Role | Upload | Search | Generate | View/Download PDF | Manage Team | Admin Panel |
|---|---|---|---|---|---|---|
| Super Admin | — | — | — | — | — | ✅ |
| Lawyer | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Associate | — | ✅ | ✅ | ✅ | — | — |
| Paralegal | — | ✅ | — | ✅ | — | — |

---

## Prerequisites

| Tool | Version |
|---|---|
| Python | 3.12 |
| Docker Desktop | Latest |
| Git | Latest |

---

## Quick Start

### 1 — Clone the repository

```bash
git clone https://github.com/marehman-exe/Lexbase.git
cd LAWYER-RAG-SYSTEM-BE
```

### 2 — Start the database

```bash
docker compose up -d
```

This starts PostgreSQL 16 + pgvector on port `5433` (avoids conflicts with a local Postgres on `5432`).

### 3 — Create the virtual environment and install dependencies

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 4 — Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in every required value (see table below). Never commit `.env` — it is gitignored.

### 5 — Run database migrations

```bash
alembic upgrade head
```

This creates all tables, enums, indexes, and the pgvector extension. Safe to run on every startup — skips already-applied migrations.

### 6 — Seed the Super Admin account

```bash
python seed.py
```

Creates the Super Admin user from `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` in `.env`. Idempotent — safe to re-run, skips if the account already exists.

### 7 — Start the API server

```bash
uvicorn main:app --reload
```

API is available at **http://localhost:8000**  
Interactive docs at **http://localhost:8000/docs**

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (e.g. `postgresql://user:pass@127.0.0.1:5433/dbname`) |
| `SECRET_KEY` | ✅ | JWT signing secret — minimum 32 random characters |
| `SUPER_ADMIN_EMAIL` | ✅ | Email for the seed Super Admin account |
| `SUPER_ADMIN_PASSWORD` | ✅ | Password for the seed Super Admin account |
| `ENVIRONMENT` | ✅ | `development` or `production` |
| `ALLOWED_ORIGINS` | ✅ | Comma-separated frontend origins for CORS (e.g. `http://localhost:5173`) |
| `GROQ_API_KEY` | ✅ | Groq API key — obtain from [console.groq.com](https://console.groq.com) |
| `LLM_PROVIDER` | — | `groq` (default) or `openrouter` |
| `LLM_MODEL` | — | `qwen/qwen3.8-27b` (dev) or `llama-3.3-70b-versatile` (standard) |
| `OPENROUTER_API_KEY` | — | Required only when `LLM_PROVIDER=openrouter` |
| `UPLOAD_DIR` | — | Directory for uploaded PDFs (default: `uploads/`) |
| `MAX_FILE_SIZE_MB` | — | Upload size cap in MB (default: `25`) |
| `MAX_DOCS_PER_FIRM` | — | Document limit per firm (default: `10`) |

---

## Project Structure

```
backend/
├── alembic/                 # Database migration scripts
│   └── versions/            # One file per migration
├── api/                     # FastAPI route handlers
│   ├── auth.py              # Login, refresh, logout, change-password
│   ├── admin.py             # Super Admin: lawyer + firm management
│   ├── users.py             # Lawyer: team management
│   ├── documents.py         # Upload, list, view, download, delete
│   ├── search.py            # Hybrid search endpoint
│   ├── generate.py          # LLM generation endpoint
│   ├── suggestions.py       # Query suggestion chips
│   └── chat_history.py      # Research Page session persistence
├── core/                    # Cross-cutting concerns
│   ├── config.py            # Settings loaded from .env
│   ├── security.py          # JWT helpers, password hashing, role deps
│   ├── limiter.py           # slowapi rate limiter instance
│   ├── llm_provider.py      # Abstract LLMProvider interface
│   └── providers/           # Concrete LLM implementations
│       ├── groq_provider.py
│       └── openrouter_provider.py
├── db/
│   └── session.py           # SQLAlchemy session factory
├── models/
│   └── orm.py               # All SQLAlchemy ORM models
├── repositories/            # Database query layer
│   ├── document_repo.py
│   ├── search_repo.py
│   ├── user_repo.py
│   └── chat_history_repo.py
├── services/                # Business logic layer
│   ├── auth_service.py      # Token issuance, refresh, revocation
│   ├── admin_service.py     # Lawyer + firm creation
│   ├── embedding_service.py # Local BGE embedding
│   ├── generation_service.py# Prompt build, LLM call, citation validation
│   ├── ingestion_service.py # PDF parse, chunk, embed, store
│   ├── query_guard.py       # Off-topic + short-query rejection
│   ├── suggestion_service.py# TF-IDF keyphrase extraction
│   └── user_service.py      # Team member management
├── uploads/                 # PDF storage (gitignored)
├── main.py                  # FastAPI app, middleware, router registration
├── seed.py                  # Super Admin bootstrap script
├── docker-compose.yml       # PostgreSQL 16 + pgvector for local dev
└── requirements.txt
```

---

## Security Architecture

| Concern | Implementation |
|---|---|
| Authentication | JWT HS256 · 15 min access token · 7 day refresh token (SHA-256 hashed + revocable) |
| Authorisation | `require_role` FastAPI dependency on every protected endpoint |
| Tenant Isolation | `firm_id` from JWT · `WHERE firm_id = :firm_id` enforced in every query |
| Rate Limiting | slowapi per-IP · 10/min login · 30/min search · 10/min generate · 5/min upload |
| Password Policy | ≥8 chars · uppercase · lowercase · digit · special character |
| Upload Security | Extension + magic bytes check · size limit · UUID filenames on disk |
| LLM Guardrails | Temperature 0.1 · passages in user message · citation validation · refusal path |
| Prompt Injection | User text never in system prompt · passages marked as untrusted reference |
| Think-block stripping | `<think>` blocks and unclosed truncated think tags removed before answer validation |
| CORS | Origin whitelist from `ALLOWED_ORIGINS` · no wildcard |

---

## LLM Generation Notes

- Model: `qwen/qwen3.8-27b` (Groq preview tier) or `llama-3.3-70b-versatile` (Groq standard tier)
- `max_tokens: 2048` — thinking models write a `<think>` block before the answer; 800 was too low
- `<think>` blocks are stripped before the answer is returned to the user
- Unclosed `<think>` tags (truncated by token limit) are also stripped
- If stripping leaves an empty answer, the service retries once with `/no_think` to disable chain-of-thought
- Every answer must contain at least one `[N]` citation — uncited answers are suppressed

---

## Milestone Progress

| Milestone | Description | Status |
|---|---|---|
| M0 | Environment & Tooling | ✅ Complete |
| M1 | Data Model & Migrations | ✅ Complete |
| M2 | Authentication & RBAC | ✅ Complete |
| M3 | Frontend Shell | ✅ Complete |
| M4 | Account & Team Management | ✅ Complete |
| M5 | Document Ingestion Pipeline | ✅ Complete |
| M6 | Embeddings & Vector Search | ✅ Complete |
| M7 | Hybrid Search — RRF | ✅ Complete |
| M8 | LLM Generation & Guardrails | ✅ Complete |
| M9 | Research Interface | ✅ Complete |
| M10 | Hardening & Handover | ✅ Complete |

---

## Known Limitations (MVP)

| Limitation | Production Fix |
|---|---|
| FastAPI BackgroundTasks — no retry on crash | Celery + Redis broker |
| Local disk file storage | S3-compatible object store (boto3) |
| Single PostgreSQL instance | Read replica for vector search queries |
| HNSW incremental inserts | Periodic `REINDEX INDEX CONCURRENTLY` |
| stdout logging only | OpenTelemetry + structured JSON + trace aggregation |
| No email delivery for credentials | SMTP integration (SendGrid / SES) |

---

## Licence

Internal use only — ILMOTECH Engineering Training Programme.
