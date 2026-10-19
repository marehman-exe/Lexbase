# LexBase

**Legal document research for law firms.**  
Search your firm's PDFs by meaning, not just keywords — with page-level citations and grounded AI summaries.

<p>
  <a href="https://lexbase-seven.vercel.app" target="_blank"><img src="https://img.shields.io/badge/Live%20Demo-lexbase--seven.vercel.app-0b1f33?style=flat-square&logo=vercel&logoColor=white" alt="Live Demo"/></a>
  <img src="https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python 3.12"/>
  <img src="https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19"/>
  <img src="https://img.shields.io/badge/PostgreSQL-16%20+%20pgvector-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/Licence-MIT-22c55e?style=flat-square" alt="MIT Licence"/>
</p>

---

## Live Demo

> **[https://lexbase-seven.vercel.app](https://lexbase-seven.vercel.app)**

The demo is the public welcome page. To run the full application — search, upload, and AI summaries — deploy the backend yourself using the [deployment guide](README-DEPLOY.md) or the Quick Start below.

---

## What it does

LexBase lets a law firm upload PDF documents and query them in plain English. The system finds the most relevant passages through hybrid search, and optionally generates a short answer built only from those passages — with numbered citations back to the source page.

| Capability | Detail |
|---|---|
| **Hybrid search** | Vector cosine similarity + BM25 full-text, fused via Reciprocal Rank Fusion |
| **Page-level citations** | Every result shows the document name and page number |
| **Grounded AI summaries** | Answer built only from retrieved passages — no hallucinated claims |
| **Multi-tenant isolation** | Each firm's documents are completely separate — enforced at the SQL layer |
| **Local embeddings** | Documents are embedded on your own server — no text sent to third parties during indexing |
| **Pluggable LLM** | Switch between Groq, OpenRouter, and Ollama from the UI or from `.env` |
| **Role-based access** | Lawyer · Associate · Paralegal — each with different permissions |
| **Research history** | Sessions saved for 7 days — query, results, and summary survive page refreshes |

---

## Architecture

```
Browser  (React 19 · TypeScript · Vite · Tailwind CSS 4)
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
         │     ├── documents · chunks (vector + tsvector + HNSW index)
         │     ├── query_logs · suggested_queries
         │     └── chat_history
         │
         ├── Local disk  (uploads/ — gitignored)
         ├── BAAI/bge-small-en-v1.5  (local embeddings — zero API cost)
         └── Groq / OpenRouter / Ollama  (pluggable LLM providers)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI · Python 3.12 · uvicorn |
| Database | PostgreSQL 16 + pgvector · HNSW vector index · GIN full-text index |
| ORM / Migrations | SQLAlchemy 2.0 + Alembic |
| Embeddings | BAAI/bge-small-en-v1.5 · 384 dims · runs locally · zero API cost |
| Search | Hybrid RRF — vector cosine + tsvector keyword fusion |
| LLM | Groq / OpenRouter / Ollama — pluggable, switchable from the UI |
| PDF Extraction | PyMuPDF (fitz) — page-level text extraction |
| Chunking | tiktoken cl100k\_base — 400 token target · 60 token overlap |
| Suggestions | scikit-learn TF-IDF — n-gram (1,3) · zero LLM cost |
| Rate Limiting | slowapi — per-IP · 10/min login · 30/min search |
| Frontend | React 19 + TypeScript · Vite 8 · Tailwind CSS 4 |
| HTTP Client | Axios + TanStack Query · JWT attach · silent 401 refresh |

---

## Role Model

| Role | Upload | Search | AI Summary | View PDF | Manage Team | Admin Panel |
|---|---|---|---|---|---|---|
| Super Admin | — | — | — | — | — | ✅ |
| Lawyer | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Associate | — | ✅ | ✅ | ✅ | — | — |
| Paralegal | — | ✅ | — | ✅ | — | — |

Role enforcement is applied on both the frontend (navigation guards) and backend (`require_role` dependency on every endpoint). The backend is the authoritative security layer.

---

## Security

| Concern | Implementation |
|---|---|
| Authentication | JWT HS256 · 15 min access token · 7 day refresh (SHA-256 hashed, revocable) |
| Authorisation | `require_role` FastAPI dependency on every protected endpoint |
| Tenant isolation | `firm_id` from JWT · `WHERE firm_id = :firm_id` enforced in all queries |
| Secrets | All credentials in `.env` · gitignored · never hardcoded |
| Rate limiting | slowapi per-IP · 10/min login · 30/min search · 10/min generate |
| Password policy | ≥ 8 chars · uppercase · lowercase · digit · special character |
| Upload safety | Extension + magic-bytes check · size limit · UUID filenames on disk |
| CORS | Origin whitelist from `ALLOWED_ORIGINS` · no wildcard |
| Prompt injection | User text never in system prompt · passages marked as untrusted reference |

---

## Quick Start (local)

### Prerequisites

| Tool | Version |
|---|---|
| Python | 3.12 |
| Node.js | 20+ |
| Docker Desktop | Latest |

### 1 — Clone

```bash
git clone https://github.com/marehman-exe/Lexbase.git
cd Lexbase
```

### 2 — Configure environment

```bash
cp .env.example .env
```

Fill in the required values:

| Variable | Note |
|---|---|
| `POSTGRES_PASSWORD` | Any strong password |
| `DATABASE_URL` | Must match `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` |
| `SECRET_KEY` | `python -c "import secrets; print(secrets.token_hex(32))"` |
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

python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
cp ../.env.example .env   # fill values if not done at root

alembic upgrade head      # run all migrations
python seed.py            # create the Super Admin account
uvicorn main:app --reload # start API server
```

Backend: **http://localhost:8000**  
API docs: **http://localhost:8000/docs**

### 5 — Set up the frontend

```bash
cd frontend
npm install
cp .env.example .env      # VITE_API_BASE_URL=http://localhost:8000
npm run dev
```

Frontend: **http://localhost:5173**

### 6 — First login

| Field | Value |
|---|---|
| Email | value of `SUPER_ADMIN_EMAIL` in your `.env` |
| Password | value of `SUPER_ADMIN_PASSWORD` in your `.env` |

---

## Production Deployment

See **[README-DEPLOY.md](README-DEPLOY.md)** for the full step-by-step guide.

**Summary:**
- **Frontend** → Vercel (free, global CDN) — set `VITE_API_BASE_URL` to your backend URL
- **Backend** → Railway or Render (Docker-based, free tier available)
- **Database** → PostgreSQL + pgvector provisioned by Railway/Render

Configurable limits (set as environment variables on your backend host):

| Variable | Default | Description |
|---|---|---|
| `MAX_DOCS_PER_FIRM` | `10` | Max documents per firm |
| `MAX_FILE_SIZE_MB` | `25` | Max upload size in MB |
| `MAX_PAGES_PER_DOC` | `800` | Max pages per document |

---

## API Reference

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `POST` | `/auth/login` | Public | Email + password → token pair |
| `POST` | `/auth/refresh` | Public | Rotate refresh token |
| `POST` | `/auth/logout` | Any | Revoke refresh token |
| `POST` | `/auth/change-password` | Any | Change own password |
| `POST` | `/admin/lawyers` | Super Admin | Create lawyer + firm |
| `GET` | `/admin/lawyers` | Super Admin | List all lawyers |
| `PATCH` | `/admin/lawyers/{id}/suspend` | Super Admin | Suspend a lawyer |
| `PATCH` | `/admin/lawyers/{id}/reactivate` | Super Admin | Reactivate a lawyer |
| `GET` | `/users` | Lawyer | List own firm's team |
| `POST` | `/users` | Lawyer | Create associate / paralegal |
| `PATCH` | `/users/{id}/deactivate` | Lawyer | Deactivate team member |
| `POST` | `/documents` | Lawyer | Upload PDF |
| `GET` | `/documents` | Firm | List firm's documents |
| `DELETE` | `/documents/{id}` | Lawyer | Delete document + chunks |
| `GET` | `/documents/{id}/file` | Firm | Stream or download PDF |
| `POST` | `/search` | Firm | Hybrid vector + keyword search |
| `POST` | `/generate` | Lawyer + Associate | LLM answer with citations |
| `GET` | `/suggestions` | Firm | Query suggestion chips |
| `POST` | `/chat-history` | Firm | Save a research session |
| `PATCH` | `/chat-history/generate` | Lawyer + Associate | Attach AI answer to session |
| `GET` | `/chat-history` | Firm | Retrieve last 7 days of sessions |
| `GET` | `/health` | Public | Service + database health check |

---

## Repository Layout

```
Lexbase/
├── backend/
│   ├── alembic/versions/         Database migration scripts
│   ├── api/                      Route handlers (auth · admin · users · documents · search · generate · …)
│   ├── core/                     Config · security · rate limiter · LLM providers
│   ├── db/                       SQLAlchemy session factory
│   ├── models/orm.py             All ORM models
│   ├── repositories/             Database query layer
│   ├── services/                 Business logic layer
│   ├── main.py                   App entry point
│   ├── seed.py                   Super Admin bootstrap
│   ├── Dockerfile                Production Docker image
│   ├── railway.json              Railway deploy config
│   ├── Procfile                  Render deploy config
│   └── .env.example              Environment variable template
│
├── frontend/
│   └── src/
│       ├── components/           Sidebar · ProtectedRoute · AppHeader · …
│       ├── context/AuthContext.tsx
│       ├── lib/api.ts            Axios instance with silent refresh queue
│       └── pages/                WelcomePage · LoginPage · DashboardPage · ResearchPage · …
│
├── vercel.json                   Vercel SPA config + security headers
├── render.yaml                   Render Blueprint (web + Postgres)
├── README-DEPLOY.md              Production deployment guide
├── .env.example                  Root environment variable template
└── docker-compose.yml            PostgreSQL 16 + pgvector (local dev)
```

---

## Milestone History

| Milestone | Description | Status |
|---|---|---|
| M0 | Environment & tooling | ✅ |
| M1 | Data model & migrations | ✅ |
| M2 | Authentication & RBAC | ✅ |
| M3 | Frontend shell | ✅ |
| M4 | Account & team management | ✅ |
| M5 | Document ingestion pipeline | ✅ |
| M6 | Embeddings & vector search | ✅ |
| M7 | Hybrid search — RRF | ✅ |
| M8 | LLM generation & guardrails | ✅ |
| M9 | Research interface | ✅ |
| M10 | Hardening & handover | ✅ |
| M11 | Persistent research history | ✅ |
| M12 | Public demo deployment | ✅ |

---

## Licence

MIT — © 2025 [marehman-exe](https://github.com/marehman-exe)
