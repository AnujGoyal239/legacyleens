# LegacyLens — Environment Variables Guide

This document lists every environment variable used by LegacyLens, which **dependency or feature** needs it, whether it is **required** or **optional**, and **how to get** the value.

---

## Quick reference

| Variable | Required? | Used by |
|----------|-----------|---------|
| `DATABASE_URL` | Yes | Prisma / PostgreSQL |
| `REDIS_URL` | Yes | BullMQ, rate limits |
| `CLERK_SECRET_KEY` | Yes | Auth (backend) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Auth (frontend) |
| `COHERE_API_KEY` | Yes | Embeddings + rerank |
| `GROQ_API_KEY` | Yes | LLM (Q&A, docs, refactor, fix-it) |
| `B2_*` (4 vars) | Yes (for meetings) | Backblaze B2 storage |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Optional* | GitHub OAuth (if using Clerk GitHub provider) |
| `STRIPE_*` | Optional | Billing |
| Others below | Optional | Server config, logging, etc. |

\* Repo clone/fetch can use a **per-project GitHub PAT** stored in the DB; the app-level GitHub env vars are for OAuth sign-in if you enable GitHub in Clerk.

---

## 1. Database (required)

### `DATABASE_URL`

- **Used by:** Prisma (Neon PostgreSQL or any Postgres).
- **Required:** Yes.
- **Format:** `postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require`
- **How to get:**
  - **Neon:** [Neon Console](https://console.neon.tech) → your project → Connection string (copy).
  - **Supabase:** Project Settings → Database → Connection string (URI).
  - **Local:** e.g. `postgresql://postgres:postgres@localhost:5432/legacylens`.

---

## 2. Redis (required)

### `REDIS_URL`

- **Used by:** BullMQ (indexing jobs), rate limits, sessions.
- **Required:** Yes.
- **Format:** `redis://[:password@]host:port[/db]`
- **How to get:**
  - **Local:** Install Redis, then `redis://localhost:6379`.
  - **Docker:** `docker run -d -p 6379:6379 redis` then same URL.
  - **Upstash / Redis Cloud:** Create database → copy connection URL (often TLS: `rediss://...`).

**Note:** `REDIS_HOST` and `REDIS_PORT` are **not** used by the app; only `REDIS_URL` is.

---

## 3. Authentication — Clerk (required)

### `CLERK_SECRET_KEY`

- **Used by:** Backend (tRPC) to verify Clerk JWTs.
- **Required:** Yes.
- **How to get:** [Clerk Dashboard](https://dashboard.clerk.com) → your application → API Keys → **Secret key** (starts with `sk_test_` or `sk_live_`).  
  Use **Secret key**, not Publishable.

### `VITE_CLERK_PUBLISHABLE_KEY`

- **Used by:** Frontend (Clerk React components, sign-in/sign-up).
- **Required:** Yes.
- **How to get:** Same Clerk app → API Keys → **Publishable key** (starts with `pk_test_` or `pk_live_`).  
  Must be prefixed with `VITE_` so Vite exposes it to the client.

---

## 4. Embeddings & search — Cohere (required for Q&A and code search)

### `COHERE_API_KEY`

- **Used by:** `src/server/services/embeddings.ts` (embed + rerank for code search and Q&A).
- **Required:** Yes for repo Q&A, architecture, and semantic search.
- **How to get:** [Cohere Dashboard](https://dashboard.cohere.com) → API Keys → Create key.  
  Free tier is available.

---

## 5. LLM — Groq (required for AI features)

### `GROQ_API_KEY`

- **Used by:**
  - `src/server/services/llm.ts` (Q&A answers, commit summaries).
  - `src/server/services/documentationGenerator.ts` (LLD, HLD, System Design).
  - `src/server/services/refactorSuggestions.ts` (extract, split, shared helper).
  - `src/server/services/fixIt.ts` (AI “fix it” suggestions).
- **Required:** Yes for Documentation (LLD/HLD/System Design), refactor suggestions, fix-it, and rich Q&A.
- **How to get:** [Groq Console](https://console.groq.com) → API Keys → Create API Key.

---

## 6. File storage — Backblaze B2 (required for meetings)

### `B2_KEY_ID`  
### `B2_APPLICATION_KEY`  
### `B2_BUCKET_NAME`  
### `B2_BUCKET_ID`

- **Used by:** `src/server/services/storage.ts` (upload/download meeting files and recordings).
- **Required:** Yes if you use **Meetings** (upload or live recording). Without these, meeting file storage will fail.
- **How to get:**
  1. [Backblaze B2](https://www.backblaze.com/b2/sign-up.html) → sign up / log in.
  2. **Bucket:** Create a bucket (e.g. `legacylens-meetings`), note **Bucket Name** and **Bucket ID**.
  3. **App key:** Application Keys → Add a new key → restrict to your bucket if desired. Copy **keyID** and **applicationKey**.
  4. Set `B2_BUCKET_NAME` and `B2_BUCKET_ID` to that bucket; set `B2_KEY_ID` and `B2_APPLICATION_KEY` to the app key.

---

## 7. GitHub (optional for OAuth; repo access can use per-project PAT)

### `GITHUB_CLIENT_ID`  
### `GITHUB_CLIENT_SECRET`

- **Used by:** Clerk GitHub OAuth provider (if you enable “Sign in with GitHub” in Clerk).
- **Required:** Only if you use GitHub as a sign-in method in Clerk.
- **How to get:**
  1. [GitHub Developer Settings](https://github.com/settings/developers) → OAuth Apps → New OAuth App.
  2. Homepage URL: your app URL (e.g. `http://localhost:5173`). Authorization callback: Clerk’s callback URL (see [Clerk GitHub](https://clerk.com/docs/authentication/social-connections/github)).
  3. Copy **Client ID** and generate **Client Secret**; add both in Clerk Dashboard → User & Authentication → Social connections → GitHub.

**Note:** Cloning and fetching repo content can use a **GitHub Personal Access Token (PAT)** stored per project in the app (e.g. when adding a private repo). The app-level `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` are for **sign-in**, not for repo API access.

---

## 8. Server & frontend URLs (optional)

### `NODE_ENV`  
### `PORT`  
### `HOST`  
### `FRONTEND_URL`  
### `API_URL`  
### `VITE_API_URL`

- **Used by:** Server (`src/server/index.ts`), Vite proxy (`vite.config.ts`), frontend tRPC (`src/lib/trpc.ts`), Stripe redirects.
- **Required:** No; defaults apply.
- **Defaults / usage:**
  - `NODE_ENV`: `development` or `production`.
  - `PORT`: `3000`.
  - `HOST`: `0.0.0.0`.
  - `FRONTEND_URL`: `http://localhost:5173` (where the Vite app runs; used for CORS and Stripe redirects).
  - `API_URL`: `http://localhost:3000` (backend; Vite proxy target).
  - `VITE_API_URL`: Same as `API_URL`; **must** be set for the frontend to call the API (tRPC base URL). In dev, usually `http://localhost:3000`.

**For production:** Set `FRONTEND_URL` and `API_URL` (and `VITE_API_URL` at build time) to your real frontend and API URLs.

---

## 9. Payments — Stripe (optional)

### `STRIPE_SECRET_KEY`  
### `STRIPE_WEBHOOK_SECRET`  
### `STRIPE_PUBLISHABLE_KEY`  
### `STRIPE_PRO_PRICE_ID`  
### `STRIPE_TEAM_PRICE_ID`

- **Used by:** `src/server/routers/billing.ts` (checkout, portal, subscription tiers).
- **Required:** No; billing is optional. If missing, billing endpoints may no-op or return empty.
- **How to get:** [Stripe Dashboard](https://dashboard.stripe.com) → Developers → API keys (Secret + Publishable). Products → create prices for Pro/Team → copy Price IDs.

---

## 10. Observability & misc (optional)

### `LOG_LEVEL`

- **Used by:** Pino logger (server and tRPC).
- **Required:** No. Default: `info`. Use `debug` for verbose logs.

### `SENTRY_DSN`

- **Used by:** Not wired in code by default; you can add Sentry and read this for the DSN.
- **Required:** No.

### `TEMP`

- **Used by:** `src/server/services/github.ts` for the temporary directory when cloning repos.
- **Required:** No. Default: `/tmp` (Unix) or `process.env.TEMP` (Windows). Set only if you need a custom temp path.

---

## Summary: minimal .env to run the app

```env
DATABASE_URL="postgresql://..."
REDIS_URL="redis://localhost:6379"
CLERK_SECRET_KEY="sk_test_..."
VITE_CLERK_PUBLISHABLE_KEY="pk_test_..."
COHERE_API_KEY="..."
GROQ_API_KEY="..."
B2_KEY_ID="..."
B2_APPLICATION_KEY="..."
B2_BUCKET_NAME="..."
B2_BUCKET_ID="..."
VITE_API_URL="http://localhost:3000"
```

Add GitHub keys if you use GitHub sign-in; add Stripe keys if you use billing. See `.env.example` for a full template.
