# LexBase — Production Deployment Guide

Deploy LexBase for free as a public demo in ~30 minutes.

- **Frontend** → [Vercel](https://vercel.com) (free, global CDN, instant redeployments)
- **Backend API** → [Railway](https://railway.app) or [Render](https://render.com) (free tier available)
- **Database** → PostgreSQL + pgvector (provisioned by Railway/Render, same free tier)

---

## Architecture Overview

```
Browser
  └─▶ Vercel CDN  (React/Vite static bundle)
         │
         │ HTTPS API calls
         ▼
  Railway / Render  (FastAPI + uvicorn)
         │
         │ SQL + vector queries
         ▼
  PostgreSQL 16 + pgvector  (Railway DB / Render Postgres)
```

---

## Step 1 — Deploy the Backend on Railway (recommended)

Railway is the simplest option because it provisions Postgres + pgvector in one click.

### 1-A  Create a Railway project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Choose **Deploy from GitHub repo** → select `marehman-exe/Lexbase`
3. When asked which service to deploy, set **Root Directory** to `backend/`
4. Railway detects `Dockerfile` automatically — no extra config needed

### 1-B  Add a Postgres database

1. In your Railway project → **+ New** → **Database** → **Add PostgreSQL**
2. Once provisioned, open the Postgres service → **Variables** tab
3. Copy the `DATABASE_URL` value (starts with `postgresql://...`)

### 1-C  Enable pgvector

Railway's Postgres image includes pgvector but the extension must be enabled once:

```bash
# In Railway dashboard → Postgres service → Query tab, run:
CREATE EXTENSION IF NOT EXISTS vector;
```

Or connect with psql:
```bash
psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 1-D  Set environment variables

In your Railway **backend service** → **Variables** tab, add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | paste the Postgres URL from 1-B |
| `SECRET_KEY` | any 40+ character random string (e.g. `openssl rand -hex 32`) |
| `ENVIRONMENT` | `production` |
| `ALLOWED_ORIGINS` | `https://lexbase.vercel.app` ← update after Vercel deploy |
| `GROQ_API_KEY` | your key from [console.groq.com](https://console.groq.com) |
| `LLM_PROVIDER` | `groq` |
| `GROQ_MODEL` | `qwen/qwen3.8-27b` |
| `SUPER_ADMIN_EMAIL` | `admin@lexbase.internal` (or your own) |
| `SUPER_ADMIN_PASSWORD` | a strong password — **change after first login** |

### 1-E  Deploy

Click **Deploy**. Railway will:
1. Build the Docker image (`python:3.12-slim`)
2. Run `alembic upgrade head` (creates all tables)
3. Run `python seed.py` (creates the super admin account)
4. Start `uvicorn main:app`

Once green, copy your Railway public URL, e.g. `https://lexbase-api-production.up.railway.app`

---

## Step 2 — Deploy the Backend on Render (alternative)

A `render.yaml` is included at the repo root for one-click Blueprint deploys.

1. Go to [render.com](https://render.com) → **New** → **Blueprint**
2. Connect your GitHub repo — Render reads `render.yaml` automatically
3. Set the secret env vars in the Render dashboard (marked `sync: false` in `render.yaml`):
   - `GROQ_API_KEY`
   - `SUPER_ADMIN_PASSWORD`
4. After deploy, enable pgvector on the Render Postgres instance:
   ```bash
   psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;"
   ```

> **Note:** Render's free tier **spins down after 15 min of inactivity** — the first request after sleep takes ~30s. Upgrade to the $7/mo Starter plan for always-on.

---

## Step 3 — Deploy the Frontend on Vercel

### 3-A  Import the repository

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import `marehman-exe/Lexbase` from GitHub
3. Vercel reads `vercel.json` at the repo root automatically

### 3-B  Configure the build

In the Vercel project settings / import wizard:

| Setting | Value |
|---|---|
| Framework Preset | **Vite** |
| Root Directory | `frontend` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

> The `vercel.json` at repo root already sets `buildCommand` and `outputDirectory` for you — Vercel will pick them up.

### 3-C  Set the environment variable

In Vercel → **Settings** → **Environment Variables**:

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://your-backend.railway.app` (your Railway URL from Step 1-E) |

Set it for **Production**, **Preview**, and **Development** environments.

### 3-D  Deploy

Click **Deploy**. Vercel will run `npm run build` and serve the `dist/` output globally.

Copy your Vercel URL, e.g. `https://lexbase.vercel.app`

---

## Step 4 — Wire the two services together

### 4-A  Update CORS on the backend

Go back to Railway (or Render) → your backend service → **Variables**:

```
ALLOWED_ORIGINS=https://lexbase.vercel.app
```

Redeploy the backend (Railway autodeploys on env var change).

### 4-B  Verify end-to-end

```bash
# 1. Health check
curl https://your-backend.railway.app/health
# Expected: {"service":"ok","database":"reachable"}

# 2. Open the frontend
open https://lexbase.vercel.app

# 3. Log in with super admin
#    Email:    admin@lexbase.internal
#    Password: (what you set in SUPER_ADMIN_PASSWORD)
```

---

## Step 5 — Create demo accounts (optional but recommended)

Log in as super admin → **Admin panel** → create demo firm and user accounts so visitors
can explore without needing admin access.

Suggested demo accounts:

| Role | Email | Notes |
|---|---|---|
| Firm Admin | `demo-admin@lawfirm.demo` | can upload documents |
| Lawyer | `demo-lawyer@lawfirm.demo` | can search and generate |
| Associate | `demo-associate@lawfirm.demo` | read-only search |

---

## Costs at a Glance

| Service | Free Tier | Paid (if needed) |
|---|---|---|
| Vercel | Unlimited static deploys | $20/mo Pro |
| Railway | $5 free credit/month | ~$5–10/mo for always-on |
| Render | 90-day free Postgres, spins down | $7/mo Starter (always-on) |

For a demo that may receive sporadic traffic, **Railway free tier** is the best fit.

---

## Environment Variables Reference

### Backend (Railway / Render)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SECRET_KEY` | ✅ | JWT signing secret (min 32 chars) |
| `ENVIRONMENT` | — | `production` or `development` |
| `ALLOWED_ORIGINS` | ✅ | Comma-separated frontend origin(s) |
| `GROQ_API_KEY` | ✅ | LLM inference key |
| `LLM_PROVIDER` | — | `groq` / `openrouter` / `ollama` |
| `GROQ_MODEL` | — | Groq model ID |
| `OPENROUTER_API_KEY` | — | Fallback LLM key |
| `SUPER_ADMIN_EMAIL` | ✅ | Admin account email |
| `SUPER_ADMIN_PASSWORD` | ✅ | Admin account password |
| `MAX_DOCS_PER_FIRM` | — | Max documents per firm (default: `10`) — raise for larger pilots |
| `MAX_FILE_SIZE_MB` | — | Max upload size in MB (default: `25`) |
| `MAX_PAGES_PER_DOC` | — | Max pages per document (default: `800`) |

### Frontend (Vercel)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_BASE_URL` | ✅ | Full URL of the deployed backend |

---

## Troubleshooting

**`502 Bad Gateway` on Vercel** — your `VITE_API_BASE_URL` points to a URL that isn't responding. Check the Railway/Render backend logs.

**`CORS error` in the browser** — `ALLOWED_ORIGINS` on the backend doesn't include your Vercel URL. Add it and redeploy the backend.

**`relation "users" does not exist`** — Alembic migrations didn't run. Check backend startup logs; run `alembic upgrade head` manually if needed.

**`pgvector extension not found`** — Run `CREATE EXTENSION IF NOT EXISTS vector;` on the database (Step 1-C or 2).

**Backend sleeping (Render free tier)** — first request after 15 min idle takes 30s. Upgrade to paid tier or use Railway instead.

**`SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set`** — set both env vars on the backend service before deploying.
