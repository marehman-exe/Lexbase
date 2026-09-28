# LexBase — Frontend

> Private legal knowledge assistant — React 19 client for the LexBase RAG system.  
> Built at ILMOTECH as part of the engineering training programme.

---

## Overview

LexBase Frontend is a single-page application (SPA) that provides a role-aware interface for law firm staff to upload legal documents, search the knowledge base using hybrid retrieval, and generate grounded AI summaries with source citations.

The frontend communicates exclusively with the [LexBase Backend API](https://github.com/marehman-exe/Lexbase) over HTTPS/JSON. All authentication is handled via JWT access tokens with automatic silent refresh — including seamless session restore on page reload.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | React | 19.x |
| Language | TypeScript | 6.x |
| Build Tool | Vite | 8.x |
| Styling | Tailwind CSS | 4.x |
| Server State | TanStack React Query | 5.x |
| HTTP Client | Axios | 1.x |
| Routing | React Router DOM | 7.x |
| JWT Decode | jwt-decode | 4.x |
| Linter | oxlint | 1.x |

---

## Pages & Role Access

| Page | Lawyer | Associate | Paralegal | Super Admin |
|---|---|---|---|---|
| Login | ✅ | ✅ | ✅ | ✅ |
| Change Password (forced on first login) | ✅ | ✅ | ✅ | ✅ |
| Research (search + AI summarise) | ✅ | ✅ | ✅ | — |
| Documents (library + index status) | ✅ | ✅ | ✅ | — |
| Team Management | ✅ | — | — | — |
| Settings (change password) | ✅ | ✅ | ✅ | — |
| Admin Panel (create/suspend lawyers) | — | — | — | ✅ |

> Role enforcement is applied on both the frontend (navigation guards) and the backend (`require_role` dependency on every endpoint). The backend is the authoritative security layer.

---

## Prerequisites

| Tool | Minimum Version |
|---|---|
| Node.js | 20.x |
| npm | 9.x |

The [LexBase Backend](https://github.com/marehman-exe/Lexbase) must be running on port `8000` before starting the frontend.

---

## Local Setup

### 1 — Clone the repository

```bash
git clone https://github.com/marehman-exe/Lexbase.git
cd LAWYER-RAG-SYSTEM-FE
```

### 2 — Install dependencies

```bash
npm install
```

### 3 — Configure environment

```bash
cp .env.example .env
```

The default `.env` value is correct for local development:

```env
VITE_API_BASE_URL=http://localhost:8000
```

> For production replace with the deployed backend URL e.g. `https://api.yourdomain.com`

### 4 — Start the development server

```bash
npm run dev
```

Open **http://localhost:5173** and log in with the Super Admin credentials set in the backend `.env`.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check and produce an optimised production build in `dist/` |
| `npm run preview` | Serve the production build locally for final verification |
| `npm run lint` | Run oxlint static analysis across all TypeScript/TSX files |

---

## Project Structure

```
src/
├── components/
│   ├── AppHeader.tsx          # Top navigation bar
│   ├── ProtectedRoute.tsx     # Auth guard — shows spinner while session restores
│   ├── Sidebar.tsx            # Role-filtered navigation sidebar
│   ├── StatusBadge.tsx        # Document processing status pill
│   ├── EmptyState.tsx         # Reusable empty-state illustration
│   ├── KpiCard.tsx            # Summary stat card
│   └── Disclaimer.tsx         # Legal AI disclaimer banner
├── context/
│   └── AuthContext.tsx        # Auth state, AuthProvider, useAuth hook
├── lib/
│   └── api.ts                 # Axios instance: JWT attach + 401 silent refresh queue
├── pages/
│   ├── AdminPage.tsx          # Super Admin: create/suspend lawyer accounts
│   ├── ChangePasswordPage.tsx # Forced password change on first login
│   ├── DashboardPage.tsx      # Role-aware shell: sidebar + active page
│   ├── DocumentsPage.tsx      # Library tab (upload/view/download/delete) +
│   │                          # Index Status tab (coverage ring, passage counts)
│   ├── LoginPage.tsx          # Email + password login form
│   ├── ResearchPage.tsx       # Hybrid search, passage cards, AI summarise
│   ├── SettingsPage.tsx       # Change password form
│   └── TeamPage.tsx           # Lawyer: create/deactivate associates + paralegals
├── types/
│   └── auth.ts                # Shared TypeScript interfaces (TokenPayload, UserRole…)
├── index.css                  # Tailwind v4 import + CSS design tokens
└── main.tsx                   # App entry point: providers and router (no StrictMode)
```

---

## Authentication Flow

```
Page load
    │
    ├── Valid access token in localStorage?
    │     YES → restore user synchronously, no network call, render immediately
    │
    └── No / expired token?
          │
          ├── Refresh token in localStorage?
          │     YES → POST /auth/refresh silently
          │             ├── Success → store new tokens, restore user, render
          │             └── Failure → clear storage, redirect to /login
          │
          └── No refresh token → redirect to /login

On any API 401 (token expired mid-session):
    ├── First 401 → start POST /auth/refresh, queue other requests
    ├── Refresh succeeds → drain queue, retry all requests with new token
    └── Refresh fails → clear storage, redirect to /login
```

> `ProtectedRoute` renders a branded loading spinner while the session is being resolved — the user never sees a blank white page.

---

## Documents Page Features

| Feature | Who |
|---|---|
| Upload PDF (up to 25 MB, max 10 per firm) | Lawyer only |
| View PDF in new browser tab (opens at page 1) | All firm roles |
| Download PDF (browser save dialog) | All firm roles |
| Delete document + all indexed passages | Lawyer only |
| Bulk select + bulk delete | Lawyer only |
| Library tab — sortable by upload date | All firm roles |
| Index Status tab — coverage ring + per-doc status | All firm roles |

---

## Research Page Features

| Feature | Who |
|---|---|
| Hybrid search (vector + keyword) | All firm roles |
| Passage cards with relevance score | All firm roles |
| Expand / collapse full passage text | All firm roles |
| Open PDF at exact passage page | All firm roles |
| Copy citation to clipboard | All firm roles |
| AI summarise with `[N]` citations | Lawyer + Associate |
| Query suggestion chips (from indexed documents) | All firm roles |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_API_BASE_URL` | ✅ | Base URL of the LexBase backend API |

> All Vite environment variables must be prefixed with `VITE_` to be accessible in the browser bundle. Never store secrets in `.env` — it is gitignored.

---

## Production Build

```bash
npm run build
```

Output is written to `dist/`. Serve with any static file host (Nginx, Vercel, Netlify, S3 + CloudFront).

**Nginx config example:**

```nginx
server {
    listen 80;
    root /var/www/lexbase/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

> The `try_files` directive is required for client-side routing — without it, direct navigation to any route other than `/` returns a 404.

---

## Related Repositories

| Repository | Description |
|---|---|
| [LAWYER-RAG-SYSTEM-BE](https://github.com/marehman-exe/Lexbase) | FastAPI backend: ingestion, embeddings, hybrid search, LLM generation |

---

## Licence

Internal use only — ILMOTECH Engineering Training Programme.
