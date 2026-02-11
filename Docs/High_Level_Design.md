# High-Level Design (HLD)
# LegacyLens — Legacy Code Intelligence Platform

**Document Type:** Technical Architecture Overview  
**Version:** 1.0  
**Last Updated:** February 10, 2026  
**Status:** Approved for Implementation

---

## 📌 Executive Summary

**Product Name:** LegacyLens  
**Tagline:** "Onboard to any codebase in hours, not weeks"

**Problem Statement:**
Developers spend 30-40% of their time trying to understand existing codebases. Inherited or legacy systems often lack documentation, have high complexity, and create massive onboarding friction. This costs companies thousands of dollars per developer in lost productivity.

**Solution:**
LegacyLens is an AI-powered platform that analyzes code repositories and provides:
- Instant architecture visualization
- Natural-language Q&A ("Why was this built this way?")
- Meeting → code linking (preserve context)
- Task board for onboarding tracking
- Automated documentation generation

**Target Users:**
1. Software consultancies & dev agencies (primary)
2. New hires at tech companies (secondary)
3. Engineering managers (tertiary)

**Business Model:**
- Freemium SaaS with tiered pricing
- Free: 1 project, limited queries
- Pro ($29/mo): 10 projects, unlimited queries
- Team ($99/mo): Unlimited projects, collaboration
- Enterprise (custom): Self-hosted, SSO, SLA

**Competitive Advantage:**
Unlike Cursor/Copilot (coding assistants), we focus on **understanding** code, not writing it. We solve the "inherited codebase" problem specifically, with features like architecture mapping, meeting intelligence, and onboarding-focused UX.

---

## 🎯 System Goals & Non-Goals

### Goals

**Functional Goals:**
1. Index any GitHub repository (10K+ files) in <5 minutes
2. Answer natural-language questions about code with 90%+ accuracy
3. Generate interactive architecture diagrams automatically
4. Transcribe meeting audio and link insights to code
5. Provide Trello-style task board for onboarding tracking

**Non-Functional Goals:**
1. **Performance:** 
   - API latency <200ms (p95)
   - Q&A response time <3 seconds
   - Architecture graph renders in <2 seconds

2. **Scalability:**
   - Support 10,000 concurrent users
   - Handle 1M vector embeddings per project
   - Process 100 repos/hour (worker cluster)

3. **Reliability:**
   - 99.5% uptime (MVP), 99.9% (production)
   - Zero data loss (PostgreSQL backups)
   - Graceful degradation (if AI APIs down, show cached results)

4. **Security:**
   - HTTPS-only
   - JWT authentication
   - Encrypted GitHub tokens
   - GDPR-compliant data handling

5. **Cost-Efficiency:**
   - <$0.10 per project indexed
   - <$0.01 per Q&A query
   - <$0.05 per meeting transcription

### Non-Goals

**What We're NOT Building (MVP):**
1. ❌ Code editor / IDE (we link to GitHub)
2. ❌ Code generation / autocomplete (not competing with Copilot)
3. ❌ CI/CD pipeline integration
4. ❌ Real-time collaboration (Phase 2)
5. ❌ Mobile apps (web-first, responsive later)
6. ❌ On-premise deployment (MVP is cloud-only)

---

## 🏗️ System Architecture Overview

### Architectural Style: **Modular Monolith → Microservices**

**Phase 1 (MVP):** 
- Single Next.js/Fastify app
- Background workers (separate processes)
- Shared PostgreSQL + Redis

**Phase 2 (Growth):**
- Extract services (indexing, transcription, Q&A)
- API Gateway pattern
- Independent scaling

**Phase 3 (Scale):**
- Event-driven architecture
- CQRS for read-heavy queries
- Kubernetes deployment

---

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                      USER LAYER                             │
│                                                             │
│  Web Browser (React SPA) ←→ Mobile Browser (responsive)    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTPS / WebSocket
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   API GATEWAY                               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Fastify + tRPC Server                       │   │
│  │                                                     │   │
│  │  • Authentication (Supabase JWT)                   │   │
│  │  • Rate limiting (Redis)                           │   │
│  │  • Request validation (Zod)                        │   │
│  │  • Logging (Pino → Betterstack)                    │   │
│  │  • Error tracking (Sentry)                         │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
┌───────────────┐               ┌───────────────┐
│   DATABASE    │               │    WORKERS    │
│    LAYER      │               │     LAYER     │
│               │               │               │
│ PostgreSQL    │               │ Indexing      │
│ (Supabase)    │               │ Transcription │
│               │               │ Embedding     │
│ Qdrant        │               │               │
│ (Vector DB)   │               │ (BullMQ/Redis)│
│               │               │               │
│ Redis         │               │               │
│ (Cache)       │               │               │
└───────────────┘               └───────────────┘
        │                                 │
        │                                 │
        └────────────────┬────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  EXTERNAL SERVICES                          │
│                                                             │
│  • GitHub API (OAuth, repo access)                         │
│  • Groq API (LLM, transcription)                           │
│  • Cohere API (embeddings, reranking)                      │
│  • Backblaze B2 (file storage)                             │
│  • Stripe (payments)                                       │
│  • Sentry (error tracking)                                 │
│  • Betterstack (monitoring)                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow Diagrams

### 1. Project Indexing Flow

```
User (Frontend)
  │
  │ 1. Create project
  │ 2. Connect GitHub repo
  │ 3. Click "Start Indexing"
  │
  ▼
API Server (Fastify)
  │
  │ • Validate user has credits
  │ • Deduct 100 credits
  │ • Update project.status = "indexing"
  │ • Enqueue job
  │
  ▼
Message Queue (BullMQ)
  │
  │ Job: { projectId, repoUrl, userId }
  │
  ▼
Indexing Worker
  │
  │ Step 1: Clone repo to /tmp
  │ Step 2: Parse files (Tree-sitter)
  │ Step 3: Extract functions/classes
  │ Step 4: Generate dependency graph
  │ Step 5: Batch create embeddings (Cohere)
  │ Step 6: Store vectors (Qdrant)
  │ Step 7: Store metadata (PostgreSQL)
  │ Step 8: Update project.status = "complete"
  │ Step 9: Delete /tmp files
  │
  ▼
Database (PostgreSQL + Qdrant)
  │
  │ • Project record updated
  │ • Files table populated
  │ • Embeddings stored
  │
  ▼
User (Frontend)
  │
  │ • Receives WebSocket update: "Indexing complete!"
  │ • Redirected to project dashboard
  └─> View architecture, ask questions
```

---

### 2. Q&A Flow (RAG Pipeline)

```
User types question: "How does authentication work?"
  │
  ▼
Frontend (React)
  │
  │ tRPC subscription call
  │
  ▼
API Server
  │
  │ 1. Check cache (Redis)
  │    Key: qa:projectId:hash(question)
  │    → Cache hit? Return cached answer
  │    → Cache miss? Continue...
  │
  ▼
Search Service
  │
  │ 1. Embed question (Cohere API)
  │    "How does authentication work?" → [0.12, 0.45, ...]
  │
  │ 2. Search vectors (Qdrant)
  │    Filter: project_id = X
  │    Top 20 results (similarity > 0.7)
  │
  │ 3. Rerank (Cohere Rerank API)
  │    Top 20 → Top 5 most relevant
  │
  ▼
LLM Service
  │
  │ 1. Build context
  │    System prompt + Top 5 code snippets
  │
  │ 2. Call Groq API (Mixtral)
  │    Stream response
  │
  ▼
API Server
  │
  │ • Stream chunks to frontend (SSE)
  │ • Save conversation to PostgreSQL
  │ • Cache result (Redis, 1hr TTL)
  │
  ▼
Frontend
  │
  │ • Display answer (streaming)
  │ • Show source files (links)
  │ • Allow follow-up questions
```

---

### 3. Meeting Transcription Flow

```
User uploads meeting.mp3
  │
  ▼
Frontend
  │
  │ • Upload to Backblaze B2 (direct)
  │ • Call API with B2 URL
  │
  ▼
API Server
  │
  │ • Deduct 10 credits
  │ • Create meeting record (status: pending)
  │ • Enqueue transcription job
  │
  ▼
Message Queue (BullMQ)
  │
  │ Job: { meetingId, fileUrl, projectId }
  │
  ▼
Transcription Worker
  │
  │ Step 1: Download audio from B2
  │ Step 2: Call Groq Whisper API
  │ Step 3: Poll until transcription complete
  │ Step 4: Chunk transcript (500 words/chunk)
  │ Step 5: Embed chunks (Cohere)
  │ Step 6: Extract insights (Groq LLM)
  │         → Decisions, action items, risks
  │ Step 7: Link chunks to code (similarity search)
  │ Step 8: Store in PostgreSQL + Qdrant
  │ Step 9: Update meeting.status = "complete"
  │
  ▼
Database
  │
  │ • Meeting record updated
  │ • Transcript stored
  │ • Insights JSON saved
  │
  ▼
User
  │
  │ • Receives notification: "Transcript ready"
  │ • Views meeting with timestamped insights
  └─> Click insight → jumps to relevant code
```

---

## 🗄️ Data Model (Conceptual)

### Core Entities

```
User
  ├─ id (UUID)
  ├─ email (unique)
  ├─ credits (integer)
  ├─ subscriptionTier (free/pro/team/enterprise)
  └─ has many Projects (via UserToProject)

Project
  ├─ id (UUID)
  ├─ name
  ├─ githubUrl
  ├─ status (pending/indexing/complete/failed)
  ├─ architectureJson (JSONB)
  ├─ has many Files
  ├─ has many Commits
  ├─ has many QAConversations
  ├─ has many Meetings
  └─ has one Board

File
  ├─ id (UUID)
  ├─ projectId (FK)
  ├─ filePath
  ├─ linesOfCode
  ├─ riskLevel (low/medium/high/critical)
  ├─ functions (JSONB)
  └─ classes (JSONB)

QAConversation
  ├─ id (UUID)
  ├─ projectId (FK)
  ├─ userId (FK)
  ├─ question
  ├─ answer
  └─ contextFiles (JSONB)

Meeting
  ├─ id (UUID)
  ├─ projectId (FK)
  ├─ transcriptText
  ├─ insights (JSONB)
  └─ fileUrl (B2)

Board
  ├─ id (UUID)
  ├─ projectId (FK)
  └─ has many Columns

Column
  ├─ id (UUID)
  ├─ boardId (FK)
  ├─ name ("To Learn", "Exploring", etc.)
  └─ has many Cards

Card
  ├─ id (UUID)
  ├─ columnId (FK)
  ├─ title
  ├─ linkedFiles (array)
  └─ assignedToId (FK to User)
```

---

## 🧩 Component Responsibilities

### 1. Frontend (React + Vite)

**Responsibilities:**
- User interface & interactions
- State management (Zustand + React Query)
- Real-time updates (WebSocket, SSE)
- Form validation (Zod)
- Routing (React Router)

**Key Pages:**
- `/` — Landing page
- `/dashboard` — Project list
- `/project/:id` — Project overview
- `/project/:id/architecture` — Graph visualization
- `/project/:id/qa` — Q&A interface
- `/project/:id/board` — Kanban board
- `/project/:id/meetings` — Meeting list

---

### 2. API Server (Fastify + tRPC)

**Responsibilities:**
- Authentication & authorization
- Request validation
- Business logic orchestration
- Rate limiting
- Error handling
- Logging & monitoring

**tRPC Routers:**
- `auth` — Login, session management
- `project` — CRUD, indexing, architecture
- `qa` — Ask questions, history
- `meeting` — Upload, transcribe, insights
- `board` — Kanban operations
- `billing` — Stripe integration

---

### 3. Workers (Background Jobs)

**Indexing Worker:**
- Clone GitHub repos
- Parse code (Tree-sitter)
- Generate embeddings (Cohere)
- Build dependency graph
- Detect tech stack
- Store in PostgreSQL + Qdrant

**Transcription Worker:**
- Download meeting files
- Call Groq Whisper API
- Chunk transcripts
- Embed chunks
- Extract insights (LLM)
- Link to code

**Embedding Worker:**
- Batch embedding requests
- Handle API rate limits
- Multi-key rotation
- Store in Qdrant

---

### 4. Databases

**PostgreSQL (Supabase):**
- Relational data (users, projects, files)
- Metadata (commits, meetings)
- Task boards
- Billing & subscriptions
- Usage logs

**Qdrant (Vector DB):**
- Code embeddings (768-dim)
- Meeting embeddings
- Semantic search
- Similarity queries

**Redis (Upstash):**
- Query caching (1hr TTL)
- Session storage
- Rate limiting
- BullMQ job queue

---

### 5. External Services

**GitHub API:**
- OAuth authentication
- Repo access (clone, file tree)
- Commit history

**Groq API:**
- LLM (Mixtral 8x7B) for Q&A
- Whisper for transcription

**Cohere API:**
- Text embeddings (v3)
- Reranking

**Backblaze B2:**
- Meeting file storage
- Temp file storage

**Stripe:**
- Payment processing
- Subscription management
- Webhooks

---

## 🔐 Security Architecture

### Authentication Flow

```
1. User clicks "Login with GitHub"
2. Redirect to Supabase Auth URL
3. Supabase redirects to GitHub OAuth
4. User authorizes app
5. GitHub redirects back to Supabase
6. Supabase generates JWT token
7. Frontend stores token (httpOnly cookie)
8. All API requests include token in header
9. API validates token (Supabase SDK)
10. User context added to request
```

### Authorization Model

**Role-Based Access Control (RBAC):**

```
Project Roles:
├─ Owner
│   └─ Can delete project, manage members
├─ Admin
│   └─ Can edit settings, invite members
├─ Member
│   └─ Can view, ask questions, create tasks
└─ Viewer
    └─ Read-only access
```

**Resource-Level Permissions:**
- Users can only access projects they're members of
- Meeting files are private per project
- Q&A history is per-user (private)
- Task boards are shared within project

---

### Data Protection

**At Rest:**
- PostgreSQL encrypted (Supabase default)
- Qdrant encrypted (HTTPS only)
- B2 files encrypted (AES-256)
- GitHub tokens encrypted (AES-256)

**In Transit:**
- HTTPS everywhere (TLS 1.3)
- WebSocket over TLS
- Signed URLs for file uploads

**Secrets Management:**
- Environment variables (never in code)
- Fly.io secrets (production)
- .env.local (development)

---

## 📈 Scalability Strategy

### Horizontal Scaling

**API Server:**
- Stateless design
- Scale to 10+ instances (Fly.io auto-scaling)
- Load balancer (Fly.io Anycast)

**Workers:**
- Independent scaling per job type
- Indexing: 1-5 workers (CPU-bound)
- Transcription: 1-3 workers (API-bound)
- Embedding: 3-10 workers (API-bound)

**Database:**
- PostgreSQL: Read replicas (Supabase)
- Qdrant: Sharding by project
- Redis: Cluster mode (if needed)

---

### Caching Strategy

**Layers:**

```
1. Browser Cache (static assets)
   └─ 1 year TTL for JS/CSS

2. CDN Cache (Cloudflare)
   └─ Edge caching for public pages

3. Application Cache (Redis)
   ├─ Q&A responses (1hr)
   ├─ Architecture graphs (24hr)
   └─ File metadata (1hr)

4. Database Cache (Prisma)
   └─ Query result caching
```

**Cache Invalidation:**
- On project update → clear architecture cache
- On new Q&A → no invalidation (append-only)
- On file change → clear file metadata

---

### Cost Optimization

**AI Usage:**
- Aggressive caching (saves 70% API calls)
- Batch embedding requests (96 at once)
- Use cheapest models (Groq, Cohere)
- Multi-key rotation (avoid rate limits)

**Storage:**
- B2 instead of S3 (10x cheaper)
- Auto-delete temp files (lifecycle policy)
- Compress meeting files before upload

**Compute:**
- Fly.io (cheaper than Vercel for backend)
- Shared CPU instances (MVP)
- Auto-scaling (only pay for usage)

---

## 🚨 Failure Modes & Recovery

### Failure Scenarios

| Failure | Impact | Mitigation | Recovery |
|---------|--------|------------|----------|
| **API Server Down** | Users can't access app | 2+ instances, health checks | Auto-restart (Fly.io) |
| **Worker Crash** | Indexing/transcription stuck | Job retry (3 attempts) | Manual re-queue |
| **PostgreSQL Down** | Total outage | Daily backups (Supabase) | Restore from backup |
| **Qdrant Down** | Q&A broken | Fallback to keyword search | Wait for recovery |
| **Redis Down** | No caching, slower | Direct DB queries | Restart Redis |
| **Groq API Rate Limit** | LLM errors | Multi-key rotation | Wait or fallback model |
| **GitHub API Limit** | Can't clone repos | Multiple GitHub apps | Wait for reset |
| **Stripe Webhook Fails** | Billing out of sync | Retry logic (exponential backoff) | Manual reconciliation |

---

### Monitoring & Alerts

**Metrics to Track:**
- API latency (p50, p95, p99)
- Error rate (4xx, 5xx)
- Worker queue length
- Database connection pool usage
- AI API spend (daily budget alert)

**Alerting Thresholds:**
- Error rate >1% → Slack alert
- API latency >2s (p95) → Slack alert
- Worker queue >100 jobs → Email alert
- AI spend >$100/day → Email + Slack
- Downtime >2 minutes → PagerDuty (enterprise)

**Tools:**
- Sentry (error tracking)
- Betterstack (uptime monitoring)
- Pino (structured logging)
- Grafana (metrics dashboard)

---

## 🧪 Testing Strategy

### Test Pyramid

```
        /\
       /  \          E2E Tests (5%)
      /────\         ├─ Critical user flows
     /      \        └─ Run nightly
    /────────\       
   /          \      Integration Tests (25%)
  /────────────\     ├─ API endpoint tests
 /              \    ├─ Worker job tests
/────────────────\   └─ Run on PR merge
     Unit Tests      
      (70%)          ├─ Pure functions
                     ├─ Service logic
                     └─ Run on every commit
```

**Coverage Goals:**
- Unit: >80%
- Integration: >60%
- E2E: Critical paths only

---

## 🚀 Deployment Pipeline

### Environments

```
Development (local)
  ↓
  • Feature branch
  • Unit tests pass
  • Type checking
  ↓
Staging (staging.legacylens.com)
  ↓
  • Integration tests pass
  • Manual QA
  • Performance testing
  ↓
Production (legacylens.com)
  ↓
  • Blue-green deployment
  • Health checks
  • Rollback ready
```

### CI/CD Workflow (GitHub Actions)

```yaml
1. On push to feature branch:
   - Run linter (ESLint)
   - Type check (TypeScript)
   - Unit tests (Vitest)

2. On PR to main:
   - All of above
   - Integration tests
   - Build Docker image
   - Deploy to staging

3. On merge to main:
   - Deploy to production (API + Workers)
   - Run smoke tests
   - Notify team (Slack)

4. On staging/production:
   - Database migrations (Prisma)
   - Seed data (if needed)
   - Health check
```

---

## 📚 Technology Stack (Final)

### Frontend
- **Framework:** React 19 + Vite
- **Styling:** TailwindCSS + shadcn/ui
- **State:** Zustand (client), React Query (server)
- **API:** tRPC (type-safe)
- **Charts:** D3.js (architecture graph)

### Backend
- **Server:** Fastify (Node.js 20)
- **API:** tRPC
- **ORM:** Prisma
- **Validation:** Zod
- **Jobs:** BullMQ

### Databases
- **Relational:** PostgreSQL (Supabase)
- **Vector:** Qdrant Cloud
- **Cache:** Redis (Upstash)

### AI/ML
- **LLM:** Groq (Mixtral 8x7B)
- **Embeddings:** Cohere Embed v3
- **Transcription:** Groq Whisper
- **Reranking:** Cohere Rerank

### Infrastructure
- **Hosting:** Fly.io (Docker)
- **Storage:** Backblaze B2
- **CDN:** Cloudflare
- **Auth:** Supabase Auth
- **Payments:** Stripe

### DevOps
- **CI/CD:** GitHub Actions
- **Monitoring:** Sentry, Betterstack
- **Logging:** Pino
- **Version Control:** Git + GitHub

---

## 📅 Rollout Plan

### Phase 1: MVP (Weeks 1-8)
**Goal:** Launch with core features

**Features:**
- ✅ GitHub OAuth login
- ✅ Connect repo + index
- ✅ Architecture visualization
- ✅ Q&A system (RAG)
- ✅ Basic task board
- ✅ Stripe billing (Pro tier)

**Success Metrics:**
- 500 signups
- 50 active projects
- 10 paying users
- NPS >40

---

### Phase 2: Growth (Months 3-6)
**Goal:** Scale user base

**Features:**
- ✅ Meeting transcription
- ✅ Team workspaces
- ✅ Advanced analytics
- ✅ Integrations (Notion, Linear)
- ✅ Mobile-responsive UI

**Success Metrics:**
- 2,000 signups
- 200 active projects
- 100 paying users
- $2,000 MRR

---

### Phase 3: Enterprise (Months 7-12)
**Goal:** Enterprise-ready

**Features:**
- ✅ SSO (SAML)
- ✅ Self-hosted option
- ✅ Audit logs
- ✅ SLA guarantees
- ✅ Custom integrations

**Success Metrics:**
- 10,000 signups
- 1,000 active projects
- 500 paying users
- $10,000 MRR
- 3 enterprise contracts

---

## ✅ Acceptance Criteria (MVP)

**Core Workflows Must Work:**

1. **User Onboarding**
   - Sign up via GitHub OAuth
   - Create first project
   - Connect GitHub repo
   - Start indexing
   - View progress bar
   - ✅ Complete in <5 minutes

2. **Ask Questions**
   - Type natural language question
   - Get answer in <3 seconds
   - See source code snippets
   - Click to view on GitHub
   - ✅ 90% accuracy

3. **View Architecture**
   - See dependency graph
   - Identify critical files
   - Filter by folder/type
   - ✅ Loads in <2 seconds

4. **Billing**
   - Click "Upgrade to Pro"
   - Enter payment (Stripe)
   - Subscription activates
   - Credits replenished
   - ✅ Works end-to-end

---

## 🎓 Lessons Learned (From Similar Products)

**From Cursor/Copilot:**
- ✅ Streaming responses feel faster
- ✅ Inline code context is crucial
- ❌ Don't try to replace IDEs

**From Sourcegraph:**
- ✅ Code search is table stakes
- ✅ Semantic search > keyword search
- ❌ Don't bloat with too many features

**From Notion/Linear:**
- ✅ Clean, minimal UI wins
- ✅ Keyboard shortcuts matter
- ❌ Don't over-engineer collaboration

---

## 📝 Open Technical Decisions

1. **Should we support other Git providers (GitLab, Bitbucket)?**
   - **Decision:** No (MVP). GitHub only. Add later if users request.

2. **Self-hosted option: Docker or Kubernetes?**
   - **Decision:** Docker Compose (easier). K8s for enterprise later.

3. **Real-time collaboration on task boards?**
   - **Decision:** No (MVP). Polling every 5 seconds is fine. WebSocket in Phase 2.

4. **Should we allow manual zip upload (no GitHub)?**
   - **Decision:** Yes (fallback for rate limits). Add in Week 4.

5. **Multi-language support (i18n)?**
   - **Decision:** No (MVP). English only. Add if international demand.

---

## 🔗 Related Documentation

- **Product Requirements (PRD):** `/PRD_LegacyLens.md`
- **Low-Level Design (LLD):** `/Low_Level_Design.md`
- **System Architecture:** `/System_Architecture.md`
- **API Specification:** (See LLD)
- **Database Schema:** (See LLD)
- **Deployment Guide:** (TBD)
- **User Manual:** (TBD)

---

**Approval Required:**
- [ ] Product Manager
- [ ] Engineering Lead
- [ ] Design Lead
- [ ] Security Review

**Version History:**
- v1.0 (Feb 10, 2026): Initial HLD — MVP scope defined

