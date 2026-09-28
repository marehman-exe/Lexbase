# LexBase — AI-Powered Legal Research Platform

> A production-grade, multi-tenant Retrieval-Augmented Generation (RAG) system built for law firms.  
> Hybrid semantic + keyword search over private document libraries, grounded AI summaries, and full role-based access control — with zero external embedding costs.

---

## Overview

LexBase lets law firms upload their own PDFs and query them using natural language. The system retrieves the most relevant passages through hybrid search (vector cosine + BM25 keyword fusion), and optionally generates a grounded AI summary with numbered source citations. Every query is scoped to the querying firm's documents — no data is ever shared across tenants.

---

## Architecture

```
Browser  (React 19 · TypeScript · Vite · Tailwind CSS 4 · TanStack Query)
    │
    │  HTTPS / JSON
    ▼
FastAPI  (Python 3.12 · uvicorn)
    │
    ├── /auth            JWT issue · refresh · revoke · change-password
    ├── /admin           Super Admin: create / suspend lawyers + firms
    ├── /users           Lawyer: create / deactivate team members
    ├── /documents       Upload · list · view · download · delete PDFs
    ├── /search          Hybrid vector + keyword search (RRF fusion)
    ├── /generate        LLM-grounded answer with [N] citations
    ├── /suggestions     Document-aware query chips (TF-IDF)
    └── /chat-history    Persist & retrieve last 7 days of research sessions
         │
         ├── PostgreSQL 16 + pgvector
         │     ├── firms · users · refresh_tokens
         │     ├── documents · chunks (vector + tsvector + HNSW)
         │     ├── query_logs · suggested_queries
         │     └── chat_history
         │
         ├── Local disk  (uploads/ — gitignored)
         ├── BAAI/bge-small-en-v1.5  (local embeddings — zero API cost)
         └── Groq / OpenRouter / Ollama  (pluggable LLM providers)
```

---

## Tech Stack

| Layer | Technology | Detail |
|---|---|---|
| Backend | FastAPI | Python 3.12 · uvicorn |
| Database | PostgreSQL 16 + pgvector | HNSW vector index · GIN full-text index |
| ORM / Migrations | SQLAlchemy 2.0 + Alembic | Typed `mapped_column` API |
| Embedding | BAAI/bge-small-en-v1.5 | 384 dims · runs locally · zero API cost |
| Search | Hybrid RRF | Vector cosine + tsvector keyword fusion |
| LLM | Groq / OpenRouter / Ollama | Pluggable providers · switchable from the UI |
| PDF Extraction | PyMuPDF (fitz) | Page-level text extraction |
| Chunking | tiktoken cl100k_base | 400T target · 60T overlap · recursive split |
| Suggestions | scikit-learn TF-IDF | n-gram (1,3) · zero LLM cost |
| Rate Limiting | slowapi | Per-IP · login 10/min · search 30/min |
| Frontend | React 19 + TypeScript | Vite 8 · Tailwind CSS 4 |
| HTTP Client | Axios + TanStack Query | JWT attach · silent 401 refresh with queue |

---

## Role Model

| Role | Upload | Search | AI Summary | View PDF | Manage Team | Admin Panel |
|---|---|---|---|---|---|---|
| Super Admin | — | — | — | — | — | ✅ |
| Lawyer | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Associate | — | ✅ | ✅ | ✅ | — | — |
| Paralegal | — | ✅ | — | ✅ | — | — |

> Role enforcement is applied on both the frontend (navigation guards) and backend (`require_role` dependency on every endpoint). **The backend is the authoritative security layer.**

---

## Security Highlights

| Concern | Implementation |
|---|---|
| Authentication | JWT HS256 · 15 min access token · 7 day refresh (SHA-256 hashed · revocable) |
| Authorisation | `require_role` FastAPI dependency on every protected endpoint |
| Tenant Isolation | `firm_id` from JWT · `WHERE firm_id = :firm_id` enforced in all queries |
| Secrets | All credentials in `.env` · gitignored · never hardcoded |
| Rate Limiting | slowapi per-IP · 10/min login · 30/min search · 10/min generate |
| Password Policy | ≥8 chars · uppercase · lowercase · digit · special character |
| Upload Security | Extension + magic-bytes check · size limit · UUID filenames on disk |
| CORS | Origin whitelist from `ALLOWED_ORIGINS` · no wildcard |
| Prompt Injection | User text never in system prompt · passages marked as untrusted reference |
| Think-block strip | `<think>` blocks + unclosed tags stripped before answer validation |
| Docker | DB credentials in `.env` · never hardcoded in `docker-compose.yml` |

---

## Repository Layout

```
Lexbase/
├── backend/                  FastAPI application
│   ├── alembic/              Database migration scripts
│   │   └── versions/         One file per migration
│   ├── api/                  Route handlers
│   │   ├── auth.py
│   │   ├── admin.py
│   │   ├── users.py
│   │   ├── documents.py
│   │   ├── search.py
│   │   ├── generate.py
│   │   ├── suggestions.py
│   │   └── chat_history.py   ← Research Page session persistence
│   ├── core/                 Cross-cutting concerns
│   │   ├── config.py         Settings from .env
│   │   ├── security.py       JWT helpers, password hashing, role deps
│   │   ├── limiter.py        slowapi rate limiter
│   │   ├── llm_provider.py   Abstract LLMProvider interface
│   │   └── providers/        Groq · OpenRouter · Ollama implementations
│   ├── db/
│   │   └── session.py        SQLAlchemy session factory
│   ├── models/
│   │   └── orm.py            All ORM models (incl. ChatHistory)
│   ├── repositories/         Database query layer
│   │   ├── base.py
│   │   ├── document_repo.py
│   │   ├── search_repo.py
│   │   ├── user_repo.py
│   │   └── chat_history_repo.py
│   ├── services/             Business logic layer
│   │   ├── auth_service.py
│   │   ├── admin_service.py
│   │   ├── embedding_service.py
│   │   ├── generation_service.py
│   │   ├── ingestion_service.py
│   │   ├── query_guard.py
│   │   ├── suggestion_service.py
│   │   └── user_service.py
│   ├── docker/               Docker init scripts
│   ├── main.py               App entry point
│   ├── seed.py               Super Admin bootstrap
│   ├── docker-compose.yml    PostgreSQL 16 + pgvector
│   ├── .env.example          Environment variable template
│   └── requirements.txt
│
├── frontend/                 React 19 SPA
│   ├── src/
│   │   ├── components/       AppHeader · Sidebar · ProtectedRoute · …
│   │   ├── context/          AuthContext (JWT state)
│   │   ├── hooks/            useTheme
│   │   ├── lib/
│   │   │   └── api.ts        Axios instance with silent refresh queue
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── ResearchPage.tsx  ← Search · AI summary · 7-day DB history
│   │   │   ├── DocumentsPage.tsx
│   │   │   ├── TeamPage.tsx
│   │   │   ├── AdminPage.tsx
│   │   │   ├── SettingsPage.tsx
│   │   │   └── ChangePasswordPage.tsx
│   │   └── types/
│   │       └── auth.ts
│   ├── .env.example
│   └── package.json
│
├── docker-compose.yml        Root compose (same as backend/docker-compose.yml)
├── .env.example              Single template for all variables
├── .gitignore                Covers secrets, builds, venvs, uploads
└── README.md                 ← You are here
```

---

## Quick Start

### Prerequisites

| Tool | Version |
|---|---|
| Python | 3.12 |
| Node.js | 20.x |
| Docker Desktop | Latest |
| Git | Latest |

---

### 1 — Clone

```bash
git clone https://github.com/marehman-exe/Lexbase.git
cd Lexbase
```

### 2 — Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in every `REQUIRED` value:

| Variable | Note |
|---|---|
| `POSTGRES_PASSWORD` | Any strong password |
| `DATABASE_URL` | Must match `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` |
| `SECRET_KEY` | Run: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `SUPER_ADMIN_EMAIL` | Your admin login email |
| `SUPER_ADMIN_PASSWORD` | Your admin login password |
| `GROQ_API_KEY` | From [console.groq.com](https://console.groq.com) |

### 3 — Start the database

```bash
docker compose up -d
```

Starts PostgreSQL 16 + pgvector on port `5433`.

### 4 — Set up the backend

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate
# Activate (macOS / Linux)
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy env (backend reads its own .env)
cp ../.env.example .env
# (or copy .env.example → .env and fill values if not done at root level)

# Run all database migrations
alembic upgrade head

# Create the Super Admin account
python seed.py

# Start the API server
uvicorn main:app --reload
```

Backend runs at **http://localhost:8000**  
Interactive API docs at **http://localhost:8000/docs**

### 5 — Set up the frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy env
cp .env.example .env
# VITE_API_BASE_URL=http://localhost:8000 is correct for local development

# Start the dev server
npm run dev
```

Frontend runs at **http://localhost:5173**

---

## API Reference

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
| `POST` | `/users` | Lawyer | Create associate / paralegal |
| `PATCH` | `/users/{id}/deactivate` | Lawyer | Deactivate team member |
| `POST` | `/documents` | Lawyer | Upload PDF (202 · background ingestion) |
| `GET` | `/documents` | Firm roles | List firm's documents |
| `GET` | `/documents/{id}` | Firm roles | Get document detail |
| `DELETE` | `/documents/{id}` | Lawyer | Delete document + chunks + file |
| `GET` | `/documents/{id}/file` | Firm roles | Stream PDF inline or download |
| `POST` | `/search` | Firm roles | Hybrid vector + keyword search |
| `POST` | `/generate` | Lawyer + Associate | LLM-grounded answer with citations |
| `GET` | `/suggestions` | Firm roles | Query suggestion chips |
| `POST` | `/chat-history` | Firm roles | Save a Research Page session |
| `PATCH` | `/chat-history/generate` | Lawyer + Associate | Attach AI answer to a session |
| `GET` | `/chat-history` | Firm roles | Retrieve last 7 days of sessions |
| `GET` | `/health` | Public | Service + database health check |

---

## Feature Highlights

### Hybrid Search (RRF)
Vector cosine similarity (HNSW index, BAAI/bge-small-en-v1.5) and BM25-style tsvector full-text search are fused using Reciprocal Rank Fusion. Results below a configurable relevance floor are suppressed so users only see genuinely relevant passages.

### Grounded AI Summaries
The LLM receives only retrieved passages — never raw user documents. Every answer must contain at least one `[N]` citation that maps back to a real passage. Uncited answers are suppressed. `<think>` reasoning blocks are stripped before delivery.

### Persistent Research History
Every search session is stored in the `chat_history` table. The Research Page drawer loads the last 7 days of sessions on mount — history survives page refreshes, browser restarts, and device switches.

### Pluggable LLM Providers
Switch between Groq, OpenRouter, and Ollama from the frontend toggle or from `.env`. Provider failures degrade gracefully — passages are always returned even if the LLM is unavailable.

### Multi-tenant Isolation
Every database query includes a `WHERE firm_id = :firm_id` clause derived from the JWT. No Python-level post-filtering — isolation is enforced at the SQL layer.

---

## Milestone Progress

| Milestone | Description | Status |
|---|---|---|
| M0 | Environment & Tooling | ✅ |
| M1 | Data Model & Migrations | ✅ |
| M2 | Authentication & RBAC | ✅ |
| M3 | Frontend Shell | ✅ |
| M4 | Account & Team Management | ✅ |
| M5 | Document Ingestion Pipeline | ✅ |
| M6 | Embeddings & Vector Search | ✅ |
| M7 | Hybrid Search — RRF | ✅ |
| M8 | LLM Generation & Guardrails | ✅ |
| M9 | Research Interface | ✅ |
| M10 | Hardening & Handover | ✅ |
| M11 | Persistent Chat History | ✅ |

---

## Licence

MIT — © 2026 [marehman-exe](https://github.com/marehman-exe)
