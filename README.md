# LegacyLens

**Onboard to any codebase in hours, not weeks.**

LegacyLens is an AI-powered platform that transforms how developers understand inherited, legacy, and unfamiliar codebases. By combining semantic code analysis, architecture visualization, task management, and AI-powered insights, we reduce onboarding time from weeks to hours.

## Features

- **Instant Codebase Intelligence** — Upload a GitHub repo and get an instant architecture overview
- **AI-Powered Q&A** — Ask natural language questions like "Why is auth handled in middleware?"
- **Visual Architecture Map** — Interactive dependency graph with risk-level indicators
- **Task Board** — Trello-style onboarding tracker linked to code sections
- **Meeting Intelligence** — Upload meeting recordings, auto-transcribe, and link insights to code

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TailwindCSS, shadcn/ui, Zustand, React Query |
| Backend | Node.js 20, Fastify, tRPC, Prisma ORM |
| Database | PostgreSQL (Supabase + pgvector for embeddings); Redis (metadata only: BullMQ, rate limits, sessions) |
| AI/ML | Groq (Mixtral 8x7B), Cohere Embed v3, Groq Whisper |
| Infrastructure | Docker, Fly.io, Backblaze B2, Stripe |

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Git

### 1. Clone and Install

```bash
git clone <repo-url>
cd legacylens
npm install
```

### 2. Set Up Environment

```bash
cp .env.example .env
# Edit .env with your API keys (Supabase, Groq, Cohere, Stripe, etc.)
```

### 3. Start Local Services

```bash
docker-compose up -d
```

This starts PostgreSQL (with pgvector) and Redis locally.

### 4. Set Up Database

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 5. Run Development Servers

```bash
# Start both frontend (Vite) and backend (Fastify) concurrently
npm run dev

# Or run separately:
npm run dev:client    # Frontend on http://localhost:5173
npm run dev:server    # Backend on http://localhost:3000

# Start background workers (in another terminal):
npm run dev:worker
```

### 6. Open the App

Navigate to [http://localhost:5173](http://localhost:5173)

## Project Structure

```
src/
├── pages/           # React page components (Landing, Dashboard, QA, etc.)
├── components/      # Reusable UI components
│   ├── layout/      # DashboardLayout, Sidebar, Header
│   └── ui/          # shadcn-style components (Toast, etc.)
├── lib/             # Client utilities (tRPC client, Supabase, helpers)
├── stores/          # Zustand state stores (auth, ui)
├── server/          # Backend (Fastify + tRPC)
│   ├── routers/     # tRPC route handlers (auth, project, qa, meeting, board, billing)
│   ├── services/    # Business logic (github, search, llm, embeddings, parser, analyzer)
│   ├── queues/      # BullMQ job queue setup
│   └── middleware/   # Auth, rate limiting
├── workers/         # Background job processors (indexing, transcription)
└── types/           # Shared TypeScript types
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend + backend concurrently |
| `npm run dev:client` | Start Vite dev server |
| `npm run dev:server` | Start Fastify API server |
| `npm run dev:worker` | Start background workers |
| `npm run build` | Build for production |
| `npm run type-check` | TypeScript type checking |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests (Vitest) |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:studio` | Open Prisma Studio |

## Architecture

```
Browser (React SPA) → Fastify + tRPC → PostgreSQL (all data + pgvector embeddings)
                                    → Redis (metadata only: BullMQ job state, rate limits, sessions)
                                    → BullMQ Workers → Groq / Cohere APIs
```

- **API**: Type-safe with tRPC (shared types between frontend and backend)
- **Auth**: Supabase Auth (GitHub OAuth + JWT)
- **Data**: All persistent data (including vector embeddings) in PostgreSQL; Redis used only for metadata (queues, rate limits, sessions)
- **Search**: RAG pipeline (Cohere embeddings → PostgreSQL pgvector similarity search → Cohere reranking → Groq LLM)
- **Jobs**: BullMQ for heavy tasks (repo indexing, transcription)

## Environment Variables

See `.env.example` for all required variables. Key services:

- **Supabase** — Auth + PostgreSQL (use pgvector extension for embeddings)
- **Groq** — LLM (Mixtral) + Whisper transcription
- **Cohere** — Embeddings + reranking
- **Stripe** — Payment processing
- **Backblaze B2** — File storage

## Deployment

### Docker

```bash
docker build -t legacylens .
docker run -p 8080:8080 --env-file .env legacylens
```

### Fly.io

```bash
fly launch
fly deploy
```

## License

Proprietary — All rights reserved.
