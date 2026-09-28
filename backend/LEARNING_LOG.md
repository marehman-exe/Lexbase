# LexBase — Learning Log

Format: What I tried · What broke · What I understood today that I didn't yesterday.

---

## 2026-08-26 — Milestone 0: Environment & Tooling

### What I tried
- Verified Python 3.12.6, Git 2.55, Docker 29.7, Node 26.7 all installed
- Created repo structure: backend/, frontend/, .gitignore, README.md
- Created Python virtual environment (.venv) and installed all dependencies
- Created docker-compose.yml with pgvector/pgvector:pg16 image
- Created core/config.py with Pydantic settings
- Created main.py with /health endpoint and DB connection check
- Ran scratch_embeddings.py — computed cosine similarity matrix manually

### What broke
- /health returned "password authentication failed" — cause: stale Docker
  volume had old credentials baked in. Fixed by docker compose down,
  docker volume rm ilmotech_lexbase_pgdata, then docker compose up fresh.
- scratch_embeddings.py failed with ModuleNotFoundError — cause: .venv
  was not activated in that PowerShell window. Fixed by running
  .venv\Scripts\Activate.ps1 first.

### What I understood today that I didn't yesterday
- A named Docker volume persists data even after the container is removed.
  Changing credentials in docker-compose.yml has no effect on an existing
  volume — you must delete the volume itself to start clean.
- .venv isolates Python packages per project. Without activating it, Python
  uses the global install which has none of the project packages.
- normalize_embeddings=True produces unit vectors so dot product equals
  cosine similarity — no separate division needed.

### Similarity Matrix Output
        S1      S2      S3      S4      S5
        S1  1.0000  0.8285  0.5789  0.6161  0.5604
S2  0.8285  1.0000  0.5696  0.6392  0.5564
S3  0.5789  0.5696  1.0000  0.7237  0.6415
S4  0.6161  0.6392  0.7237  1.0000  0.5937
S5  0.5604  0.5564  0.6415  0.5937  1.0000

---

## 2026-08-31 — Milestone 1: Data Model and Migrations

### What I tried
- Declared six SQLAlchemy 2.0 declarative models (`firms`, `users`, `refresh_tokens`,
  `documents`, `chunks`, `query_logs`)
- Initialised Alembic, edited `env.py` to wire up `Base.metadata` and load
  `DATABASE_URL` from settings
- Wrote the first migration by hand (did not use `--autogenerate`) to create the
  `vector` extension before any tables
- Wrote a seed script that creates the Super Admin idempotently
- Established the repository skeleton with `firm_id` as a required argument on every
  data-access method

### What broke and why
- `Can't load plugin: sqlalchemy.dialects:driver` — `env.py` was not edited; Alembic
  was using the placeholder URL from `alembic.ini` instead of the real one from `.env`
- `Could not parse SQLAlchemy URL from string ''` — `.env` file did not exist yet;
  config had no values to load
- UTF-8 BOM in `.env` — `Out-File -Encoding utf8` in Windows PowerShell 5 writes a
  BOM; pydantic-settings read the first key as `﻿DATABASE_URL` and could not match it
- `bcrypt 5.x` incompatibility with `passlib 1.7.4` — pinned `bcrypt==4.0.1` to fix
- `invalid input value for enum userrole: "SUPER_ADMIN"` — SQLAlchemy sent the Python
  enum *name* (uppercase) instead of the enum *value* (lowercase); fixed with
  `values_callable=lambda x: [e.value for e in x]`

### What I understood that I did not understand yesterday
- Python enums have both a `.name` (the identifier, uppercase by convention) and a
  `.value` (the stored string). SQLAlchemy's default behaviour sends the name. PostgreSQL
  enums are case-sensitive and store the value. Mismatch causes a runtime error that
  compiles and migrates cleanly but fails on first INSERT. The fix — `values_callable`
  — forces SQLAlchemy to use the value instead of the name.
- A BOM (byte order mark) is a three-byte sequence (0xEF 0xBB 0xBF) prepended by some
  Windows editors and PowerShell's `Out-File` to signal UTF-8 encoding. It is invisible
  in most editors but included in the parsed key name, so `DATABASE_URL` becomes
  `﻿DATABASE_URL` and no settings field matches. Fix: use `Out-File -Encoding utf8NoBOM`
  or `Set-Content` instead.
- The vector extension must be created in the migration (not manually in psql) because
  the migration script is the only authoritative record of how to build the schema from
  scratch. Any step done manually outside migrations cannot be reproduced on a fresh
  machine and will break `alembic upgrade head` for any new developer.

---

## 2026-09-01 — Milestone 2: Authentication and Role-Based Access

### What I tried
- Wrote JWT creation and verification in `core/security.py` using `python-jose`
- Built `authenticate_user`, `issue_tokens`, `refresh_access_token`,
  `revoke_refresh_token` in `services/auth_service.py`
- Wrote login, refresh, and logout routes in `api/auth.py`
- Wired `get_current_user` and `require_role` as FastAPI dependencies
- Tested all routes manually through /docs — login, refresh rotation, logout,
  revoked token rejection
- Decoded the access token at jwt.io and confirmed all five payload fields

### What broke and why
- `ImportError: cannot import name 'authenticate_user'` — `auth_service.py` was
  created but not yet populated. Fixed by writing the full service before importing it.
- Timing oracle: the original `authenticate_user` returned early on unknown email
  without running bcrypt, making it measurably faster than a wrong-password response.
  Fixed by always running bcrypt against a dummy hash even when the email is not found.

### What I understood that I did not understand yesterday
- The JWT payload is a Base64-encoded JSON object, readable by anyone who intercepts
  the token. It is still safe to include `firm_id` and `role` because the signature
  (HMAC-SHA256 using the `SECRET_KEY`) makes tampering detectable. The server validates
  the signature on every request — it never trusts the payload without verifying the
  signature first. Confidentiality of the payload is not required; integrity is.
- Refresh tokens are stored hashed because if the database is read by an attacker, a
  plain-text refresh token would allow them to immediately issue new access tokens.
  Storing the hash means the attacker gets a useless string — they cannot reverse the
  hash to get the token needed for the refresh call.
- Token rotation means the server issues a new refresh token on every refresh call and
  invalidates the old one. If a token is stolen and the legitimate user refreshes first,
  the stolen token is already revoked. If the attacker refreshes first, the next
  legitimate call will fail (the old token was already rotated away), alerting the user.
- 204 No Content on logout is correct because the operation has no result to return.
  Returning 200 with `{"message": "logged out"}` would be technically correct but adds
  nothing — the client already knows what it did. 204 also prevents mistakenly treating
  the response body as meaningful.

---

## 2026-09-03 — Milestone 3: Frontend Shell and Authenticated Session

### What I tried
- Scaffolded React 18 + Vite + TypeScript app in frontend/
- Built AuthContext to hold user state decoded from the JWT, persisted across
  page refresh via localStorage
- Built ProtectedRoute that redirects to /login if no user in context
- Built LoginPage with form validation and error display
- Built DashboardPage showing role, user ID, and firm ID from the decoded token
- Wired all providers in main.tsx: BrowserRouter, QueryClientProvider, AuthProvider
- Added CORS middleware to the FastAPI backend

### What broke and why
- Vite boilerplate App.tsx/main.tsx was committed before being replaced — server error
  on startup. Fixed by overwriting the files completely.
- frontend/.env was empty — VITE_API_BASE_URL was undefined so axios called
  `undefined/auth/login`. Fixed by setting the correct value.
- CORS errors (405 on preflight) — CORSMiddleware was not added to main.py.
  Fixed by adding it before `include_router`.
- venv not activated in seed terminal — ModuleNotFoundError for passlib.
  Fixed by running Activate.ps1 first.

### What I understood that I did not understand yesterday
- Vite reads `.env` once at startup. Changes to `.env` while the dev server is running
  have no effect until the server is restarted (`npm run dev` again). This is different
  from runtime environment variables — there is no hot-reload for `.env`.
- CORSMiddleware must be added before routers because FastAPI processes middleware in
  the order they are added. A preflight OPTIONS request must be handled by the CORS
  middleware before it reaches a router that has no OPTIONS handler and would return 405.
- A preflight request is an HTTP OPTIONS call sent automatically by the browser before a
  cross-origin request that uses a non-simple method (POST, PUT, etc.) or custom headers
  (Authorization). The browser is asking the server "do you allow this?". If the server
  does not respond with the correct CORS headers, the browser blocks the actual request.
- localStorage persists until explicitly cleared (via DevTools or `localStorage.clear()`).
  It survives page refresh (F5), tab close, and even browser restart. It is not cleared
  by deleting cookies. The only browser action that clears it is "Clear site data" which
  includes localStorage specifically.

---

## 2026-09-04 — Milestone 4: Account and Team Management

### What I tried
- Built Super Admin routes: `POST /admin/lawyers` (creates Firm + Lawyer in one
  transaction), `GET /admin/lawyers`, `PATCH /admin/lawyers/{id}/suspend|reactivate`
- Built Lawyer routes: `POST /users/team`, `GET /users/team`,
  `PATCH /users/team/{id}/deactivate`
- Confirmed `firm_id` always comes from the verified JWT — never from the request
  body or path
- Built `AdminPage.tsx`: create Lawyer form (initial password shown once), Lawyers
  table with Suspend/Reactivate actions (window.confirm on destructive actions)
- Built `TeamPage.tsx`: add Associate/Paralegal form, team table with Deactivate
- Wired `must_change_pw`: login response carries the flag, stored in localStorage,
  `ChangePasswordPage` intercepts the dashboard until the password is changed,
  `POST /auth/change-password` clears the flag server-side
- Fixed team-member cap: `count_active_users_in_firm` counts only Associates and
  Paralegals — the Lawyer who owns the firm is excluded
- Added explicit 403 (not 400) when a Lawyer attempts to create a role=lawyer account;
  added `_require_firm_id()` null-guard in all repository methods

### What broke and why
- The team-member cap initially counted the Lawyer themselves, so a newly created firm
  immediately showed 1/10 members. Fixed by filtering `role != lawyer` in the count.
- `PATCH /users/team/{id}/deactivate` initially returned 403 for a cross-firm user_id.
  Changed to 404 — a 403 confirms the record exists, which is information leakage
  across firm boundaries.
- The seed script was not idempotent on the `role` field: re-running it with a different
  seed email would find the existing row by email and skip the role check. Fixed by
  asserting `existing.role == SUPER_ADMIN` in addition to checking the email.

### What I understood that I did not understand yesterday
- `firm_id` must come from the JWT because the JWT is signed by the server. If
  `firm_id` came from the request body, any client could claim to belong to any firm.
  This is the fundamental IDOR (Insecure Direct Object Reference) attack: the attacker
  sets `firm_id` to a victim firm's ID and gains read or write access to their data.
  The JWT signature prevents this — you cannot forge the payload without the SECRET_KEY.
- Deactivating a cross-firm user returns 404 because 403 Forbidden would implicitly
  confirm that the user exists — it just isn't accessible to the caller. 404 reveals
  nothing: the resource either does not exist or is not accessible to you.
- "A deactivated user's token stops working" means that `get_current_user` (the FastAPI
  dependency injected into every protected route) queries the database on every request
  and checks `user.is_active`. A deactivated user's JWT signature remains valid (JWTs
  cannot be revoked remotely), but the database check causes every subsequent request to
  return 401. The token is technically valid; the user is not permitted.
- The 10-member cap counts Associates and Paralegals only because the cap governs the
  team members a Lawyer creates for their firm, not the Lawyer themselves. The Lawyer
  is the account owner, not a seat under the cap. Including them would reduce the
  effective limit to 9 without any intentional design reason.

---

## 2026-09-05 — Milestone 5: Document Ingestion Pipeline

### What I tried
- Built `ingestion_service.py`: PDF validation (extension + magic bytes + size +
  encryption + scan detection), UUID-named disk storage, page-by-page text extraction
  with PyMuPDF (fitz), recursive chunking (paragraph → sentence → token), batch insert
- Chunk parameters: TARGET_TOKENS = 400, OVERLAP_TOKENS = 60, MAX_TOKENS = 480
- Status machine: pending → processing → ready (or failed)
- Wired as FastAPI BackgroundTask — returns 202 immediately, ingests after response

### What broke and why
- `fitz.open()` on a password-protected PDF raised an exception rather than returning
  a clean error. Fixed by catching the exception and checking `pdf.is_encrypted` after
  open, then returning a user-readable failure message.
- Overlapping chunks produced duplicate passages in search results. This is expected
  and intentional — the overlap ensures context boundaries do not cut a sentence mid-
  thought. Deduplication is handled at the result-display layer, not the storage layer.
- Background ingestion silently failed on the first test because the db session from
  the request handler had already been closed before the task ran. Fixed by opening
  a dedicated `SessionLocal()` inside `run_ingestion()`.

### What I understood that I did not understand yesterday
- Chunking on token count rather than character count is necessary because embedding
  models have a fixed token budget (384 tokens for BGE-small). A character-count
  approach would produce chunks that exceed the model's context window on dense text,
  causing the tail of the chunk to be silently truncated before embedding — the stored
  vector would not represent the full chunk text.
- Overlap exists because semantic boundaries rarely align with document structure
  boundaries. A sentence that starts near the end of one chunk and continues into the
  next would be split in half without overlap, making neither chunk fully answerable.
  The cost is storage (OVERLAP_TOKENS × chunk_count extra tokens) and occasional
  duplicate passages in search results.
- The file is stored under a UUID name because the client-supplied filename is
  untrusted. A filename like `../../../etc/passwd` is a path traversal attack. A UUID
  makes the stored name unguessable and safe to use directly on disk.
- A document is `processing` from the moment the background task starts until it
  completes or fails. `failed` means an unrecoverable error occurred — bad PDF, scan,
  zero chunks. `ready` means at least one chunk was produced, embedded, and inserted.
  A document stays in `pending` if the server restarts before the background task runs.
- The scanned-PDF check counts total characters across all extracted pages. A scan
  is an image — PyMuPDF extracts zero text from it. A digital PDF always has text.
  The threshold (< 100 chars for the whole document) is conservative but reliable:
  a genuine legal document with fewer than 100 characters of content is implausible.

---

## 2026-09-06 — Milestone 6: Embeddings and Vector Search

### What I tried
- Integrated BAAI/bge-small-en-v1.5 via `sentence-transformers` — 384-dimension model,
  runs locally without API calls
- Applied BGE query prefix ("Represent this sentence for searching relevant passages:")
  to query embeddings only, not passage embeddings, as specified by the model card
- Built vector search in `search_repo.py` using pgvector's cosine distance operator
  (`<=>`) with `firm_id` filter in SQL
- Created HNSW index on the `chunks.embedding` column after bulk load
- Verified with `EXPLAIN ANALYZE` that the HNSW index was being used
- Set relevance floor at 0.30; ran ten-question evaluation (see RETRIEVAL_EVALUATION.md)

### What broke and why
- Initial search returned results from other firms during testing with two accounts.
  Cause: the SQL `WHERE` clause was applied as a Python post-filter, not in the query.
  Fixed by moving `firm_id = :firm_id` into the SQL `WHERE` clause.
- EXPLAIN showed the HNSW index was not used on the first queries — the planner chose
  a sequential scan because the table was too small. Index usage appeared once the
  chunk count exceeded the planner's threshold (~100 rows).

### What I understood that I did not understand yesterday
- The BGE query prefix matters. The model was trained with asymmetric pairs: passages
  are indexed without a prefix; queries are encoded with the prefix. Removing the prefix
  from queries produces embeddings in a slightly different semantic space, reducing
  recall. Using the prefix on passage embeddings also reduces quality. The asymmetry is
  intentional and documented by the model authors.
- pgvector's `<=>` operator returns *distance* (0 = identical, 2 = maximally different
  for unit vectors). Similarity = `1 - distance`. The HNSW index approximates nearest
  neighbours — it may miss the globally optimal result for speed. For a legal KB of
  tens of thousands of chunks, this trade-off is correct.

---

## 2026-09-06 — Milestone 7: Hybrid Search (RRF)

### What I tried
- Added tsvector column to `chunks` table and GIN index for full-text search
- Built `keyword_search()` in `search_repo.py` using `ts_rank` and `plainto_tsquery`
- Implemented Reciprocal Rank Fusion in Python: score = Σ `1 / (k + rank)`, k = 60
- Combined both legs, deduplicated by chunk_id, sorted by fused score
- Re-ran the ten-question evaluation; results in RETRIEVAL_EVALUATION.md

### What broke and why
- Hybrid search was slower than vector-only by ~30ms on first run. Cause: two database
  round-trips instead of one. Acceptable given the quality improvement; noted for
  future optimisation (single SQL UNION query would eliminate one round-trip).
- RRF initially double-counted chunks: if a chunk appeared in both legs, its scores
  were appended rather than summed. Fixed by checking `chunk_id` in a running dict
  and summing scores for duplicates.

### What I understood that I did not understand yesterday
- RRF with k=60 is robust to rank position differences between the two legs. A chunk at
  rank 5 in both legs scores `1/65 + 1/65 ≈ 0.031` — more than a chunk at rank 1 in
  one leg only (`1/61 ≈ 0.016`). The constant k=60 was chosen by the original authors
  because it reduces the sensitivity of the formula to high-variance outlier ranks. It
  is not tuned per dataset; it is a robust default.
- tsvector columns store pre-processed tokens (stemmed, stop words removed) for fast
  full-text matching. A GIN (Generalized Inverted Index) maps each token to the rows
  containing it — the same data structure used in search engine inverted indexes.
  Without the GIN index, every keyword search would require a full table scan.

---

## 2026-09-07 — Milestone 8: Generation and Guardrails

### What I tried
- Built `generation_service.py` with structured system prompt, passage delimiters,
  citation validation, and `_strip_thinking()` for Qwen chain-of-thought suppression
- Built `generate.py` API endpoint (Lawyer + Associate only; Paralegal excluded)
- Red-teamed the system with 8 attack vectors (see Red_TEAM.md)
- Confirmed `refused: true` path on off-corpus questions
- Set temperature = 0.1, max_tokens capped, `reasoning_effort: none` for Qwen

### What broke and why
- Groq returned 404 model_not_found for `llama-3.3-70b-versatile` — that model was
  not available on the account. Lesson: verify available models via `GET /v1/models`
  on the day you start the milestone. Switched to `qwen/qwen3.6-27b`.
- Qwen model returned chain-of-thought reasoning tags (`<think>...</think>`) in the
  response body. Fixed by setting `reasoning_effort: none` in the Groq payload and
  adding `_strip_thinking()` as a defensive second pass.
- Citation validation initially used a simple `[` character check — matched footnote
  brackets in the passages themselves. Fixed to require the pattern `\[\d+\]`
  (bracketed integer) which is the format explicitly requested in the system prompt.

### What I understood that I did not understand yesterday
- Temperature controls how deterministic the model's output is. At temperature 0, the
  model always picks the highest-probability next token. At temperature 1, it samples
  according to the full distribution. For a legal research tool, determinism is a
  feature: the same query should return the same citations. Temperature 0.1 is as close
  to deterministic as practical without removing all natural-language variation.
- Placing retrieved passages in the *user message* rather than the *system prompt* is
  a security decision. The system prompt defines the model's behaviour and is harder
  to override. A document containing "IGNORE ALL PREVIOUS INSTRUCTIONS" in the user
  message is treated as data, not instructions. If the same text were in the system
  prompt, it could interfere with the model's operating rules.
- An uncited answer is a hallucination risk. The model may generate a plausible-sounding
  legal statement that is not in any retrieved passage. Citation validation is the only
  automated check available: if the model cannot cite a source, the answer is suppressed
  and the user is shown the raw passages instead. This is the correct failure mode for a
  legal tool.

---

## 2026-09-08 — Milestone 9: Chat Interface

### What I tried
- Built full ResearchPage.tsx with search form, passage cards with rank badges, and
  the Summarise with Sources generation flow
- Implemented citation click-through: `[N]` in the generated answer scrolls and
  highlights the corresponding passage card
- Added session query history: last 10 searches rendered as chip row ("Recent:")
- Added query term highlighting in passage text using a split/regex approach
- Wired document upload directly from the Research page (Lawyer only)
- Fixed the 401 refresh race condition in api.ts: concurrent API calls on token expiry
  now queue behind a single refresh call instead of each attempting their own

### What broke and why
- The Summarise button initially opened the dark summary card even when the LLM
  returned `fallback: true`. Fixed by gating card rendering on
  `generateResp && !generateResp.fallback`.
- The `highlightTerms` function used a regex with the `g` flag and `.test()` inside
  `.map()`. The `g` flag advances `lastIndex` on each call, causing alternating
  matches to fail. Fixed by using a non-`g` flag test regex for the type guard
  and a separate `g` regex for the split.
- Query history chips were not deduplicated — running the same query twice produced
  two identical chips. Fixed by filtering before prepend:
  `[trimmed, ...prev.filter(q => q !== trimmed)].slice(0, 10)`.

### What I understood that I did not understand yesterday
- The 401 refresh race condition is a real problem in SPAs with token-based auth.
  Without a request queue, three concurrent API calls that all receive 401 will each
  independently call `POST /auth/refresh`. Only the first one succeeds; the other two
  receive 401 because the refresh token was already rotated. The fix is a pending-
  refresh flag and a queue: all subsequent calls wait for the first refresh to
  complete, then retry with the new token.
- JavaScript regex with the `g` (global) flag maintains internal state (`lastIndex`).
  Each call to `.test()` or `.exec()` advances the pointer. When the same regex object
  is reused in a loop (e.g. inside `.map()`), even-indexed calls may return false
  because `lastIndex` is past the match. The fix is either to reset `lastIndex = 0`
  before each call, or to create a new regex without the `g` flag for the type check.

---

## 2026-09-09 — Milestone 10: Hardening and Handover

### What I tried
- Added rate limiting to `/search` (30/min), `/generate` (10/min), and
  `/documents` upload (5/min) using `@limiter.limit` decorators
- Created `core/limiter.py` to break the circular import between `main.py` and routers
- Added correlation ID middleware: every request gets a `X-Request-ID` response header
  (UUID generated server-side, or forwarded if client supplied one)
- Added env-driven CORS (`ALLOWED_ORIGINS` setting); removed wildcard
- Fixed `/health` to never expose database connection strings in error responses
- Fixed timing oracle in `auth_service.py`: always runs bcrypt even for unknown emails
- Added password complexity policy (≥8 chars, uppercase, lowercase, digit, special char)
  on both backend (`_validate_password_strength`) and frontend (`SettingsPage`)
- Added `_require_firm_id()` null-guard in `document_repo.py` and `search_repo.py`
- Completed README with 7-step setup guide, demo path, env table, known limitations
- Added document-aware suggestion chips: TF-IDF keyphrase extraction via
  `suggestion_service.py`, stored in `suggested_queries` table, served by
  `GET /suggestions`
- Merged Documents and Knowledge Base pages — the coverage ring and system status
  panel now live as a sidebar inside the Documents page

### What broke and why
- `@limiter.limit` without `request: Request` as the first function parameter caused
  slowapi to raise a `ValueError: Expected `request` or `websocket` argument`.
  Fixed by adding `request: Request` as the first positional parameter on every
  rate-limited route handler.
- The `SuggestedQuery` TF-IDF extractor initially returned single words because
  `TfidfVectorizer` default `min_df=2` required terms to appear in at least 2 chunks.
  A single-page document with only one chunk produced zero suggestions. Fixed by
  setting `min_df=1`.
- The leaked Groq API key (`gsk_PivvnT2GI...`) was found in `.env.example` committed
  to git history. The key was immediately replaced with a placeholder. The real key
  must be revoked in the Groq dashboard — replacing it in the file does not invalidate
  the key itself.

### What I understood that I did not understand yesterday
- A circular import occurs when module A imports from module B, and module B imports
  from module A. Python's import system resolves modules lazily — the first import
  starts executing the module file. If that file imports another file that hasn't
  finished executing yet, the partially-initialised module is used, which may be missing
  the symbol being imported. The fix is to extract the shared dependency (the `limiter`
  object) into a third module that neither A nor B imports.
- Correlation IDs are essential for production debugging. When a user reports "it
  failed at 3:14pm", you need to find the corresponding server log line. Without a
  correlation ID, you search by timestamp and hope. With one, you search by ID and find
  every log line for that exact request across all services. The client can read the
  `X-Request-ID` response header and include it in a support report.
- TF-IDF (Term Frequency–Inverse Document Frequency) scores a term higher when it
  appears frequently in a specific document but rarely across all documents. This makes
  it a natural "what is this document about" signal: common legal boilerplate ("shall",
  "herein", "pursuant") has low IDF because it appears in every document; specific terms
  ("force majeure", "rent review", "probationary period") have high IDF because they
  are distinctive. The result is keyphrases that are genuinely representative of the
  document's subject matter.
