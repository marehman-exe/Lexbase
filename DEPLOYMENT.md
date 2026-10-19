# LexBase — Production Deployment Guide

This guide deploys LexBase as a public demo:

| Layer    | Platform              | Cost           |
|----------|-----------------------|----------------|
| Frontend | Vercel                | Free           |
| Backend  | Railway               | Free trial / ~$5/mo |
| Database | Railway PostgreSQL    | Free trial / ~$5/mo |

---

## Architecture

```
Browser
  └─► Vercel (React SPA)
        └─► Railway (FastAPI backend)
              └─► Railway PostgreSQL + pgvector
```

---

## Step 1 — Push your code to GitHub

1. Create a **new GitHub repo** (e.g. `lexbase`) — make it **Public** or **Private** (both work).
2. Push your local project:

```bash
git remote add origin https://github.com/YOUR_USERNAME/lexbase.git
git add .
git commit -m "chore: add production deployment files"
git push -u origin main
```

---

## Step 2 — Deploy the Database on Railway

1. Go to [https://railway.app](https://railway.app) → **New Project** → **Deploy a template** → search **"PostgreSQL"** → Deploy it.
2. Once the database is running, click it → **Variables** tab → copy these values:
   - `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`
3. Also click **Connect** → copy the **PostgreSQL Connection URL** — it looks like:
   ```
   postgresql://postgres:PASSWORD@HOST:PORT/railway
   ```
4. **Enable pgvector**: Click the database service → **Query** tab → run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

---

## Step 3 — Deploy the Backend on Railway

1. In the same Railway project, click **New Service** → **GitHub Repo** → select your repo.
2. Railway will auto-detect the `backend/Dockerfile`. If it asks for a root directory, set it to **`backend`**.
3. Go to the service → **Variables** tab → add all of these:

| Variable               | Value                                          |
|------------------------|------------------------------------------------|
| `DATABASE_URL`         | The PostgreSQL URL from Step 2                |
| `SECRET_KEY`           | Run: `python -c "import secrets; print(secrets.token_hex(32))"` and paste result |
| `ENVIRONMENT`          | `production`                                   |
| `ALLOWED_ORIGINS`      | `https://YOUR_VERCEL_APP.vercel.app` ← fill after Step 4 |
| `SUPER_ADMIN_EMAIL`    | e.g. `admin@lexbase.demo`                      |
| `SUPER_ADMIN_PASSWORD` | A strong password (you'll use this to log in)  |
| `LLM_PROVIDER`         | `groq`                                         |
| `GROQ_API_KEY`         | Your key from [console.groq.com](https://console.groq.com) |
| `GROQ_MODEL`           | `qwen/qwen3.8-27b`                             |
| `OPENROUTER_API_KEY`   | Optional fallback key from [openrouter.ai](https://openrouter.ai/keys) |
| `OPENROUTER_MODEL`     | `qwen/qwen3.8-27b:free`                        |
| `UPLOAD_DIR`           | `uploads`                                      |
| `MAX_FILE_SIZE_MB`     | `25`                                           |
| `MAX_PAGES_PER_DOC`    | `800`                                          |
| `MAX_DOCS_PER_FIRM`    | `10`                                           |

4. Click **Deploy**. Watch the build logs — it installs ~1.5 GB of ML deps so it takes **5–10 minutes** the first time.
5. Once deployed, click **Settings** → **Networking** → **Generate Domain**.
   - Copy the URL, e.g. `https://lexbase-backend-production.up.railway.app`
6. **Seed the admin account**: Go to Railway → your backend service → **Shell** tab → run:
   ```bash
   python seed.py
   ```

---

## Step 4 — Deploy the Frontend on Vercel

1. Go to [https://vercel.com/abdurrehmanm778-6227](https://vercel.com/abdurrehmanm778-6227) → **Add New Project** → **Import Git Repository** → select your repo.
2. Set **Root Directory** to `frontend`.
3. Framework preset will auto-detect as **Vite** — leave it.
4. Under **Environment Variables**, add:

| Variable            | Value                                                    |
|---------------------|----------------------------------------------------------|
| `VITE_API_BASE_URL` | Your Railway backend URL, e.g. `https://lexbase-backend-production.up.railway.app` |

5. Click **Deploy**. Vercel builds in ~60 seconds.
6. Copy your Vercel app URL, e.g. `https://lexbase.vercel.app`.

---

## Step 5 — Wire up CORS

1. Go back to Railway → your backend service → **Variables**.
2. Update `ALLOWED_ORIGINS` to your Vercel URL:
   ```
   https://lexbase.vercel.app
   ```
   If you have a custom domain too: `https://lexbase.vercel.app,https://yourdomain.com`
3. Railway will automatically redeploy with the new value.

---

## Step 6 — Verify

1. Open your Vercel URL in a browser.
2. Log in with the `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` you set.
3. Test the API health endpoint: `https://YOUR_RAILWAY_URL/health`
   - Should return: `{"service":"ok","database":"reachable"}`

---

## Important Notes

### ⚠️ Uploaded Documents Are Ephemeral on Railway
Railway's file system is **not persistent** across redeploys. PDFs uploaded by users will be lost when the service restarts. For a production-grade setup, replace the local `uploads/` folder with an S3-compatible object store (e.g. Cloudflare R2 — free tier). For a demo, this is acceptable.

### ⚠️ Ollama / Local LLM
The "Local" LLM mode in the frontend requires Ollama running on the user's machine. It will not work in a public cloud deployment — this is by design. Groq and OpenRouter work fine from Railway.

### ⚠️ First Request Cold Start
The BGE embedding model (`BAAI/bge-small-en-v1.5`) loads on the first search/generate request after a cold start (~5–15s). Subsequent requests are fast. On Railway's free tier the service sleeps after inactivity — expect a cold start when someone visits after a period of idle.

### 🔑 Sharing Login Credentials for the Demo
Use the Super Admin account to create additional user accounts, or share the admin credentials directly with demo users. The admin panel is at `/admin` in the app.

---

## Custom Domain (Optional)

- **Vercel**: Project → Settings → Domains → Add your domain.
- **Railway**: Service → Settings → Networking → Custom Domain.

---

## Environment Variable Quick Reference

### Backend (Railway)
```
DATABASE_URL=postgresql://...
SECRET_KEY=<64-char hex>
ENVIRONMENT=production
ALLOWED_ORIGINS=https://YOUR_APP.vercel.app
SUPER_ADMIN_EMAIL=admin@example.com
SUPER_ADMIN_PASSWORD=StrongPassword123!
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_...
GROQ_MODEL=qwen/qwen3.8-27b
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=qwen/qwen3.8-27b:free
UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=25
MAX_PAGES_PER_DOC=800
MAX_DOCS_PER_FIRM=10
```

### Frontend (Vercel)
```
VITE_API_BASE_URL=https://YOUR_RAILWAY_BACKEND.up.railway.app
```
