# Architecture Note — LexBase MVP

## Overview

LexBase is a multi-tenant RAG (Retrieval-Augmented Generation) application for law
firms. Each firm has an isolated knowledge base of indexed PDF documents. Users query
the knowledge base via hybrid search and optionally generate grounded LLM summaries.

The system completed eleven milestones over approximately two weeks of engineering
training. This note documents the architectural decisions made at each layer and
identifies where they should be revisited before production use.

---

## System Architecture

```
Browser (React 18 + Vite + TypeScript)
    │
    │  HTTPS / JSON   (Axios, React Query)
    ▼
FastAPI (Python 3.12)  ← uvicorn, single process
    │
    ├── auth/          JWT issue, refresh, revoke, change-password
    ├── admin/         Super Admin: create Lawyers and firms
    ├── users/         Lawyer: create/deactivate Associates and Paralegals
    ├── documents/     Upload (Lawyer), list/get (all firm roles), delete (Lawyer)
    ├── search/        Hybrid search (all firm roles)
    ├── generate/      LLM generation (Lawyer + Associate)
    └── suggestions/   Document-aware query chips (all firm roles)
         │
         ├── PostgreSQL 16 + pgvector
         │     ├── firms, users, refresh_tokens
         │     ├── documents, chunks (vector + tsvector)
         │     ├── query_logs
         │     └── suggested_queries
         │
         ├── Local disk  (uploads/)
         │
         ├── sentence-transformers  (BAAI/bge-small-en-v1.5, local)
         │
         └── Groq API  (qwen/qwen3.6-27b)
```

---

## Backend Decisions

### 1. FastAPI BackgroundTasks → Celery + Redis at scale

Document ingestion runs inside `fastapi.BackgroundTasks`. The task runs in the same
uvicorn worker process and shares its memory. If the process restarts mid-ingestion,
the task is lost and the document stays in `processing` state with no automatic retry.

**Why acceptable for MVP:** The training programme scope is 10 documents per firm with
one firm in the demo. Task loss is recoverable by re-uploading.

**Production fix:** Celery with a Redis broker. Tasks are durable (persisted in Redis),
retryable (configurable retry policy), and run in separate worker processes that can
be scaled independently of the API.

---

### 2. Local disk storage → S3-compatible object store at scale

PDF files are written to `uploads/` on the server's local filesystem. The stored
filename is a server-generated UUID to prevent path traversal. The original filename
is stored only in the database and is never used on disk.

**Why acceptable for MVP:** Single-server deployment; no horizontal scaling.

**Production fix:** S3 or MinIO. The `save_file` and `delete_file` functions in
`ingestion_service.py` are the only two touch-points. Replacing them with boto3 calls
is a one-file change. The rest of the system does not interact with the filesystem
directly.

---

### 3. Single PostgreSQL instance → read replica for search queries

All reads and writes share one Postgres container. Vector similarity search (`<=>`)
with HNSW is CPU-intensive under concurrent load and competes with write transactions.

**Why acceptable for MVP:** One firm, ten documents, tens of thousands of chunks.
HNSW on this volume completes in single-digit milliseconds.

**Production fix:** Add a read replica and route all `SELECT` statements from
`search_repo.py` to the replica. SQLAlchemy supports multiple engine bindings via
a custom `Session` factory.

---

### 4. HNSW index built incrementally → periodic rebuild at scale

pgvector's HNSW index is updated incrementally as new chunks are inserted. Incremental
insertions into HNSW are slower and produce slightly lower-quality approximate nearest
neighbour graphs than a batch build. The difference is negligible at thousands of
chunks; it compounds at millions.

**Why acceptable for MVP:** The per-firm document limit (10 docs, 800 pages max,
~400-token chunks) produces at most ~8,000 chunks per firm. HNSW quality at this
scale is indistinguishable from a full rebuild.

**Production fix:** A nightly `REINDEX INDEX CONCURRENTLY` on the HNSW index, or
periodic index replacement using pgvector's `CREATE INDEX ... WITH (m = 16, ef_construction = 64)`.

---

### 5. No structured logging → OpenTelemetry at scale

Application logs go to uvicorn stdout as unstructured text. The correlation ID
middleware (`X-Request-ID` header) was added in M10 and enables manual log correlation,
but there is no log aggregation, trace sampling, or span hierarchy.

**Why acceptable for MVP:** Single-process, single-operator system. Log volume is low
and all logs are in one place.

**Production fix:** Add `structlog` for structured JSON logging; emit spans via
OpenTelemetry SDK; ship to a backend (Jaeger, Grafana Tempo, or Datadog). The
correlation ID middleware already generates the trace root ID — the remaining work is
attaching it to log records and creating child spans for DB queries and LLM calls.

---

### 6. In-process LLM provider abstraction → multi-provider routing

The LLM provider is selected at startup via `LLM_PROVIDER` and `LLM_MODEL` environment
variables. Both Groq and OpenRouter providers are implemented. Switching provider
requires only an environment variable change — no code change.

**Why correct at all scales:** The abstraction is complete. The provider interface
(`generate_answer`) is stable and provider-agnostic.

**Future consideration:** Implement a fallback chain — if Groq returns a rate limit
error, retry via OpenRouter. This requires a try/except in `generation_service.py`
and a second provider configured in settings.

---

## Frontend Decisions

### 7. Client-side page guards → defence in depth, not the security layer

`DashboardPage.tsx` contains an `ALLOWED_PAGES` map that prevents navigation to pages
a role is not permitted to see. The `navigate_to()` function drops any navigation
attempt to a forbidden page key.

**Correct design:** These guards are UX, not security. Every restricted action is
also enforced server-side by `require_role()` FastAPI dependencies. A malicious client
that bypassed the frontend guards would receive 403 from the API on any data request.
The frontend guards exist to prevent accidental access and to keep the UI coherent.

---

### 8. React Query as the data layer

All server state is managed by `@tanstack/react-query`. Queries are cached with
appropriate stale times (documents: no stale time — always fresh during processing;
suggestions: 5-minute stale time). The 401 interceptor in `api.ts` implements a
request queue to handle concurrent token refresh correctly.

**Why this matters:** Without the queue, concurrent requests on token expiry would each
attempt to refresh, burning the refresh token. The queue serialises refresh calls so
only one executes; all queued requests retry with the new token.

---

### 9. Document-aware suggestion chips

After a document finishes ingesting, `suggestion_service.py` runs TF-IDF over all
chunks and stores up to 8 keyphrases per document in the `suggested_queries` table.
The Research page fetches these via `GET /suggestions` and displays them as clickable
chips labelled "From your documents:". When no documents are indexed, static fallback
chips are shown instead.

**Design choice:** Using TF-IDF rather than an LLM call for suggestion generation
adds zero API cost, requires no network access, and runs in under 100ms on the
chunk volumes supported by this system. The quality is sufficient for this use case:
phrases are distinctive enough to be useful, without being so specific that they read
as hallucinated questions.

---

## Database Schema Summary

| Table | Purpose | Key constraints |
|---|---|---|
| `firms` | Tenant registry | `id` UUID PK |
| `users` | Authentication + RBAC | Unique index on `lower(email)`; `firm_id` nullable for Super Admin |
| `refresh_tokens` | Token revocation | Hashed token; `revoked` flag |
| `documents` | Upload metadata | `firm_id` FK; `stored_filename` unique UUID |
| `chunks` | Text + vector storage | `firm_id` FK; HNSW on `embedding`; GIN on `tsvector` |
| `query_logs` | Audit trail | Every search and generate call logged with latency |
| `suggested_queries` | UI chip cache | Populated post-ingestion; firm-scoped |

---

## Security Architecture Summary

| Concern | Implementation |
|---|---|
| Authentication | JWT (HS256); access token 30 min; refresh token 7 days, hashed, revocable |
| Authorisation | `require_role` FastAPI dependency on every protected endpoint |
| Tenant isolation | `firm_id` from JWT; SQL-level `WHERE firm_id = :firm_id`; Python-level `_require_firm_id()` null guard |
| Rate limiting | slowapi: 10/min login, 30/min search, 10/min generate, 5/min upload |
| Password policy | ≥8 chars, uppercase, lowercase, digit, special character — enforced on backend and frontend |
| Upload security | Extension + magic bytes check; size limit enforced during streaming; UUID filenames |
| LLM guardrails | Low temperature (0.1); passages in user message; citation validation; explicit refusal path |
| Prompt injection | User text never in system prompt; passages labelled as untrusted reference material |
| Secret management | All config via Pydantic settings; app refuses to start if required vars are missing |
| Error responses | Generic messages only; stack traces to server log, never to client |
| CORS | Origin list from `ALLOWED_ORIGINS` env var; no wildcard |
| Correlation IDs | `X-Request-ID` header on every request/response for log correlation |
| Health endpoint | DB reachability only; never exposes connection strings or error details |

---

## Five decisions I would revisit at real scale

1. **FastAPI BackgroundTasks → Celery + Redis** — task durability and retry
2. **Local disk storage → S3-compatible object store** — multi-instance support
3. **Single PostgreSQL instance → read replica** — read/write separation under load
4. **HNSW incremental inserts → periodic rebuild** — recall quality at millions of chunks
5. **stdout logging → OpenTelemetry + structured JSON** — production observability
