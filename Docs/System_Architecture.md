# System Architecture Document
# LegacyLens — Legacy Code Intelligence Platform

**Version:** 1.0  
**Last Updated:** February 10, 2026  
**Owner:** Engineering Team

---

## 📐 Architecture Overview

### Design Philosophy

**Principles:**
1. **Simplicity First** — Start monolithic, extract services when needed
2. **Cost-Optimized** — Use cheapest reliable solutions
3. **Horizontally Scalable** — Stateless services, message queues
4. **Fault-Tolerant** — Graceful degradation, retry logic
5. **Developer Experience** — Fast local dev, easy debugging

**Architecture Style:**
- **Initial (MVP):** Modular monolith (single deployment)
- **Growth (Month 6):** Microservices (separate workers)
- **Scale (Year 2):** Distributed with event sourcing

---

## 🏗️ High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐         │
│  │   Browser    │    │  Mobile Web  │    │   CLI Tool   │         │
│  │  (React SPA) │    │  (Responsive)│    │  (Future)    │         │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘         │
│         │                   │                   │                  │
│         └───────────────────┴───────────────────┘                  │
│                             │                                       │
│                    HTTPS / WebSocket                               │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
┌─────────────────────────────┼───────────────────────────────────────┐
│                         API GATEWAY                                 │
│                   ┌─────────▼─────────┐                            │
│                   │   Fastify Server   │                            │
│                   │   (Node.js 20)     │                            │
│                   │                    │                            │
│                   │  • tRPC Endpoints  │                            │
│                   │  • REST APIs       │                            │
│                   │  • WebSocket       │                            │
│                   │  • Auth Middleware │                            │
│                   └─────────┬─────────┘                            │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌────────────────┐    ┌──────────────┐
│ PROJECT       │    │ MEETING        │    │ Q&A          │
│ SERVICE       │    │ SERVICE        │    │ SERVICE      │
│               │    │                │    │              │
│ • Repo index  │    │ • Transcribe   │    │ • RAG query  │
│ • Parse code  │    │ • Extract      │    │ • Stream LLM │
│ • Generate    │    │   insights     │    │ • Caching    │
│   embeddings  │    │ • Link to code │    │              │
│               │    │                │    │              │
└───────┬───────┘    └────────┬───────┘    └──────┬───────┘
        │                     │                   │
        └─────────────────────┼───────────────────┘
                              │
                       Message Queue
                    ┌────────▼────────┐
                    │   BullMQ/Redis  │
                    │                 │
                    │  • index:repo   │
                    │  • meeting:proc │
                    │  • embed:batch  │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ INDEXING     │    │ TRANSCRIPTION│    │ EMBEDDING    │
│ WORKER       │    │ WORKER       │    │ WORKER       │
│              │    │              │    │              │
│ • Clone repo │    │ • Call Groq  │    │ • Batch API  │
│ • Parse AST  │    │   Whisper    │    │ • Cohere     │
│ • Extract    │    │ • Chunk text │    │ • Store vec  │
│   metadata   │    │ • Link files │    │              │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│                    DATA LAYER                                    │
│                          │                                       │
│  ┌───────────────────────┼───────────────────────────────┐      │
│  │                       ▼                               │      │
│  │  ┌─────────────────────────────────────────────┐     │      │
│  │  │      PostgreSQL (Supabase)                  │     │      │
│  │  │                                             │     │      │
│  │  │  • User, Project, Meeting tables           │     │      │
│  │  │  • Task boards (Board, Column, Card)       │     │      │
│  │  │  • Metadata (commits, files)               │     │      │
│  │  └─────────────────────────────────────────────┘     │      │
│  │                                                       │      │
│  │  ┌─────────────────────────────────────────────┐     │      │
│  │  │      Qdrant Cloud (Vector DB)               │     │      │
│  │  │                                             │     │      │
│  │  │  • Code embeddings (768-dim)               │     │      │
│  │  │  • Meeting embeddings                      │     │      │
│  │  │  • Collections per project                 │     │      │
│  │  └─────────────────────────────────────────────┘     │      │
│  │                                                       │      │
│  │  ┌─────────────────────────────────────────────┐     │      │
│  │  │      Redis (Caching + Queue)                │     │      │
│  │  │                                             │     │      │
│  │  │  • Query cache (1hr TTL)                   │     │      │
│  │  │  • Session store                           │     │      │
│  │  │  • BullMQ jobs                             │     │      │
│  │  └─────────────────────────────────────────────┘     │      │
│  │                                                       │      │
│  │  ┌─────────────────────────────────────────────┐     │      │
│  │  │      Backblaze B2 (Object Storage)          │     │      │
│  │  │                                             │     │      │
│  │  │  • Meeting audio/video files               │     │      │
│  │  │  • User uploads                            │     │      │
│  │  │  • Temp repo clones (auto-delete)          │     │      │
│  │  └─────────────────────────────────────────────┘     │      │
│  └───────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                             │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   GitHub     │  │   Groq API   │  │  Cohere API  │          │
│  │   (OAuth)    │  │  (LLM/Voice) │  │  (Embeddings)│          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Stripe     │  │   Sentry     │  │ Betterstack  │          │
│  │  (Billing)   │  │  (Errors)    │  │ (Monitoring) │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🧩 Component Breakdown

### 1. Frontend (Client Layer)

**Technology:**
- React 19 (latest features: Server Components possible future migration)
- Vite (build tool — faster than Webpack)
- TailwindCSS + shadcn/ui (consistent design system)
- React Query (server state management)
- Zustand (client state)
- React Router v6 (navigation)

**Key Pages:**
```
/                           → Landing page
/login                      → Auth (redirect to Supabase)
/dashboard                  → Project list
/project/:id                → Project overview
  ├─ /architecture          → Visual dependency graph
  ├─ /qa                    → Q&A interface
  ├─ /board                 → Task board (Kanban)
  ├─ /meetings              → Meeting list
  └─ /settings              → Project settings
/account                    → User account, billing
/docs                       → Documentation
```

**Communication:**
- **tRPC** for type-safe API calls
- **WebSocket (Socket.io)** for real-time updates (task board, indexing progress)
- **Server-Sent Events (SSE)** for streaming LLM responses

**State Management:**
```
Zustand (global client state):
├─ authStore (user session)
├─ projectStore (current project)
└─ uiStore (modals, toasts)

React Query (server state):
├─ useProjects()
├─ useProjectDetails(id)
├─ useQuestionAnswer()
└─ useMeetings()
```

---

### 2. API Gateway (Fastify Server)

**Technology:**
- **Fastify** (Node.js framework — 2x faster than Express)
- **tRPC** (type-safe RPC)
- **Zod** (validation)
- **Prisma** (ORM)

**Port:** 3000 (development), 8080 (production)

**Middleware Stack:**
```
Request
  ↓
1. CORS (allow frontend origin)
2. Rate Limiting (100 req/min per IP)
3. Auth (JWT validation via Supabase)
4. Logging (pino logger)
5. Error Handler (Sentry integration)
  ↓
tRPC Router
  ↓
Response
```

**tRPC Routers:**

```typescript
// File: src/server/routers/index.ts
export const appRouter = router({
  auth: authRouter,        // login, signup, logout
  project: projectRouter,  // CRUD projects
  qa: qaRouter,            // ask questions
  meeting: meetingRouter,  // upload, transcribe
  board: boardRouter,      // task management
  billing: billingRouter,  // Stripe integration
});
```

**Key Endpoints:**

| Router | Procedure | Description |
|--------|-----------|-------------|
| `auth` | `login` | GitHub OAuth flow |
| `auth` | `getSession` | Get current user |
| `project` | `create` | Create new project |
| `project` | `connect` | Connect GitHub repo |
| `project` | `index` | Start indexing job |
| `project` | `getDetails` | Get project + files |
| `project` | `getArchitecture` | Get dependency graph JSON |
| `qa` | `ask` | Ask question (streaming) |
| `qa` | `history` | Get Q&A history |
| `meeting` | `upload` | Upload meeting file |
| `meeting` | `getTranscript` | Get transcript + insights |
| `board` | `createTask` | Add task to board |
| `board` | `moveTask` | Update task column |
| `billing` | `checkout` | Create Stripe session |
| `billing` | `webhook` | Handle Stripe events |

**REST Endpoints (non-tRPC):**

```
POST   /api/webhooks/stripe        → Stripe webhook handler
GET    /api/health                 → Health check
POST   /api/upload                 → File upload (multipart)
GET    /api/download/:fileId       → Download file
```

---

### 3. Background Workers

**Why Workers?**
- Prevent API timeouts (indexing takes 5+ minutes)
- Scale horizontally (add more workers under load)
- Retry failed jobs automatically
- Decouple heavy tasks from user-facing API

**Job Queue: BullMQ + Redis**

```
Redis Server (port 6379)
  ├─ Queue: indexing
  ├─ Queue: transcription
  ├─ Queue: embedding
  └─ Queue: notifications
```

**Worker Processes:**

```
┌─────────────────────────────────────────┐
│   Indexing Worker (indexing.worker.ts)  │
│                                         │
│   Listens to: "indexing" queue          │
│   Job: { projectId, repoUrl }           │
│                                         │
│   Steps:                                │
│   1. Clone repo to /tmp                 │
│   2. Parse files (Tree-sitter)          │
│   3. Extract functions/classes          │
│   4. Generate dependency graph          │
│   5. Batch create embeddings (Cohere)   │
│   6. Store in Qdrant + PostgreSQL       │
│   7. Update project.status = "complete" │
│   8. Delete /tmp files                  │
│                                         │
│   Concurrency: 2 jobs at once           │
│   Timeout: 30 minutes per job           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Transcription Worker (meeting.worker.ts)│
│                                         │
│   Listens to: "transcription" queue     │
│   Job: { meetingId, fileUrl }           │
│                                         │
│   Steps:                                │
│   1. Download audio from B2             │
│   2. Call Groq Whisper API              │
│   3. Poll until complete                │
│   4. Chunk transcript (500 words/chunk) │
│   5. Generate embeddings (Cohere)       │
│   6. Extract insights (LLM)             │
│   7. Link chunks to code (similarity)   │
│   8. Store in PostgreSQL + Qdrant       │
│                                         │
│   Concurrency: 3 jobs at once           │
│   Timeout: 15 minutes per job           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│   Embedding Worker (embed.worker.ts)    │
│                                         │
│   Listens to: "embedding" queue         │
│   Job: { texts[], projectId }           │
│                                         │
│   Steps:                                │
│   1. Batch texts (max 96 per call)      │
│   2. Call Cohere Embed API              │
│   3. Store vectors in Qdrant            │
│   4. Update metadata in PostgreSQL      │
│                                         │
│   Concurrency: 5 jobs at once           │
│   Timeout: 5 minutes per job            │
└─────────────────────────────────────────┘
```

**Job Retry Logic:**
```typescript
// BullMQ job options
{
  attempts: 3,                    // Retry up to 3 times
  backoff: {
    type: 'exponential',
    delay: 2000                   // 2s, 4s, 8s
  },
  removeOnComplete: true,         // Clean up after success
  removeOnFail: false             // Keep failed jobs for debugging
}
```

---

### 4. Database Layer

#### 4.1 PostgreSQL (Primary Database)

**Provider:** Supabase (managed PostgreSQL)
**Version:** PostgreSQL 15

**Schema Overview:**

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  github_id TEXT UNIQUE,
  credits INTEGER DEFAULT 1000,
  subscription_tier TEXT DEFAULT 'free', -- free, pro, team
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  github_url TEXT,
  github_repo_id TEXT,
  default_branch TEXT DEFAULT 'main',
  
  -- Indexing metadata
  status TEXT DEFAULT 'pending', -- pending, indexing, complete, failed
  total_files INTEGER DEFAULT 0,
  processed_files INTEGER DEFAULT 0,
  total_lines INTEGER DEFAULT 0,
  
  -- Generated artifacts
  architecture_json JSONB,        -- Dependency graph
  tech_stack JSONB,               -- Detected technologies
  entry_points TEXT[],            -- Main files
  
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Files (metadata only, content in Qdrant)
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_type TEXT,                 -- js, py, java, etc.
  lines_of_code INTEGER,
  
  -- Metadata
  is_entry_point BOOLEAN DEFAULT false,
  risk_level TEXT DEFAULT 'low',  -- low, medium, high (based on dependents)
  dependents_count INTEGER DEFAULT 0,
  
  -- Parsed data
  functions JSONB,                -- List of functions
  classes JSONB,                  -- List of classes
  imports JSONB,                  -- Import statements
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Q&A History
CREATE TABLE qa_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  context_files JSONB,            -- Which files were used
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meetings
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT,
  duration_seconds INTEGER,
  file_url TEXT,                  -- B2 storage URL
  
  -- Processing
  transcription_status TEXT DEFAULT 'pending', -- pending, processing, complete, failed
  transcript_text TEXT,
  
  -- AI-extracted insights
  insights JSONB,                 -- { decisions: [], actionItems: [], risks: [] }
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task Boards (Trello-style)
CREATE TABLE boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'Onboarding',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,      -- Order of columns
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id UUID REFERENCES columns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL,
  
  -- Links
  linked_files TEXT[],            -- File paths
  linked_qa_ids UUID[],           -- Related Q&A conversations
  
  -- Metadata
  assigned_to UUID REFERENCES users(id),
  time_spent_minutes INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Billing (Stripe integration)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  tier TEXT DEFAULT 'free',       -- free, pro, team, enterprise
  status TEXT DEFAULT 'active',   -- active, canceled, past_due
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  project_id UUID REFERENCES projects(id),
  action TEXT,                    -- index, qa, meeting
  cost_credits INTEGER,           -- Credits consumed
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexes:**
```sql
-- Performance indexes
CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_files_project ON files(project_id);
CREATE INDEX idx_qa_project ON qa_conversations(project_id);
CREATE INDEX idx_meetings_project ON meetings(project_id);
CREATE INDEX idx_cards_column ON cards(column_id);

-- Full-text search (for meetings, Q&A)
CREATE INDEX idx_qa_question_fts ON qa_conversations USING gin(to_tsvector('english', question));
CREATE INDEX idx_meetings_transcript_fts ON meetings USING gin(to_tsvector('english', transcript_text));
```

---

#### 4.2 Qdrant (Vector Database)

**Provider:** Qdrant Cloud (free tier: 1M vectors)
**Dimensions:** 768 (Cohere Embed v3)

**Collections:**

```
Collection: code_embeddings
  ├─ Vectors: 768-dim
  ├─ Payload:
  │   ├─ project_id (UUID)
  │   ├─ file_path (string)
  │   ├─ content (string, full code snippet)
  │   ├─ type (string: function, class, file)
  │   ├─ summary (string: AI-generated)
  │   └─ metadata (object)
  └─ Index: HNSW (fast similarity search)

Collection: meeting_embeddings
  ├─ Vectors: 768-dim
  ├─ Payload:
  │   ├─ meeting_id (UUID)
  │   ├─ chunk_text (string)
  │   ├─ timestamp_start (integer, seconds)
  │   ├─ timestamp_end (integer, seconds)
  │   └─ linked_files (array of file paths)
  └─ Index: HNSW
```

**Search Strategy:**
```typescript
// When user asks question
async function searchCode(query: string, projectId: string) {
  // 1. Embed the query
  const queryVector = await cohere.embed([query]);
  
  // 2. Search Qdrant
  const results = await qdrant.search('code_embeddings', {
    vector: queryVector[0],
    filter: { must: [{ key: 'project_id', match: { value: projectId } }] },
    limit: 20,  // Top 20 results
    score_threshold: 0.7  // Minimum similarity
  });
  
  // 3. Rerank (optional, for better precision)
  const reranked = await cohere.rerank({
    query,
    documents: results.map(r => r.payload.content),
    top_n: 5
  });
  
  return reranked;
}
```

---

#### 4.3 Redis (Cache + Queue)

**Provider:** Upstash Redis (generous free tier)
**Use Cases:**

```
1. Query Cache
   Key: qa:cache:{hash(question)}
   Value: { answer, context, timestamp }
   TTL: 3600 seconds (1 hour)

2. Session Store
   Key: session:{userId}
   Value: { token, projects[] }
   TTL: 86400 seconds (24 hours)

3. Rate Limiting
   Key: ratelimit:{userId}:{endpoint}
   Value: request_count
   TTL: 60 seconds

4. BullMQ Queues
   Key: bull:{queueName}:*
   (Managed by BullMQ library)
```

**Cache Strategy:**
```typescript
// Caching Q&A responses
async function getAnswer(question: string, projectId: string) {
  const cacheKey = `qa:${projectId}:${hash(question)}`;
  
  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  // Generate answer
  const answer = await generateAnswer(question, projectId);
  
  // Cache for 1 hour
  await redis.set(cacheKey, JSON.stringify(answer), 'EX', 3600);
  
  return answer;
}
```

---

#### 4.4 Backblaze B2 (Object Storage)

**Use Case:** Store large files (meeting audio/video)
**Cost:** $0.005/GB/month (10x cheaper than S3)

**Bucket Structure:**
```
Bucket: legacylens-meetings
  ├─ /{userId}/{meetingId}/audio.mp3
  └─ /{userId}/{meetingId}/metadata.json

Bucket: legacylens-temp
  ├─ /{projectId}/repo.zip (auto-delete after 1 hour)
  └─ /{projectId}/processing/ (worker temp files)
```

**Lifecycle Policy:**
- Files in `temp/` bucket auto-delete after 24 hours
- Meeting files retained for 90 days (free tier), 1 year (pro/team)

---

## 🔌 External Service Integration

### 1. GitHub API

**OAuth Flow:**
```
1. User clicks "Connect GitHub"
2. Redirect to: github.com/login/oauth/authorize?client_id=...
3. GitHub redirects to: /api/auth/callback?code=...
4. Exchange code for access token
5. Store token in database (encrypted)
6. Fetch user repos via GitHub API
```

**API Usage:**
- Fetch repo file tree: `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1`
- Download file content: `GET /repos/{owner}/{repo}/contents/{path}`
- Get commit history: `GET /repos/{owner}/{repo}/commits`

**Rate Limits:**
- Authenticated: 5,000 req/hour
- Mitigation: Cache repo data for 24 hours

---

### 2. Groq API (LLM + Transcription)

**Models:**
- **LLM:** `mixtral-8x7b-32768` (cheap, fast, 32K context)
- **Transcription:** `whisper-large-v3` (best accuracy)

**Cost:**
- LLM: $0.27 per 1M tokens (input), $0.27 per 1M tokens (output)
- Whisper: $0.111 per hour of audio

**Usage Patterns:**

```typescript
// Q&A Generation
async function generateAnswer(question: string, context: string[]) {
  const response = await groq.chat.completions.create({
    model: 'mixtral-8x7b-32768',
    messages: [
      {
        role: 'system',
        content: 'You are a code explanation assistant. Answer based only on the provided code context.'
      },
      {
        role: 'user',
        content: `Context:\n${context.join('\n\n')}\n\nQuestion: ${question}`
      }
    ],
    temperature: 0.3,  // Lower = more factual
    max_tokens: 1000,
    stream: true  // Stream response to user
  });
  
  return response;
}

// Transcription
async function transcribe(audioUrl: string) {
  const file = await fetch(audioUrl);
  const blob = await file.blob();
  
  const response = await groq.audio.transcriptions.create({
    file: blob,
    model: 'whisper-large-v3',
    language: 'en',  // Optional: auto-detect if omitted
    response_format: 'verbose_json',  // Includes timestamps
    timestamp_granularities: ['segment']  // Paragraph-level timestamps
  });
  
  return response.segments;  // Array of { text, start, end }
}
```

---

### 3. Cohere API (Embeddings + Reranking)

**Models:**
- **Embeddings:** `embed-english-v3.0` (768-dim, $0.10 per 1M tokens)
- **Reranking:** `rerank-english-v3.0` ($1.00 per 1K searches)

**Usage:**

```typescript
// Generate embeddings (batch for efficiency)
async function embedTexts(texts: string[]) {
  const response = await cohere.embed({
    texts: texts,  // Max 96 texts per call
    model: 'embed-english-v3.0',
    input_type: 'search_document',  // Or 'search_query' for questions
    truncate: 'END'  // Truncate if >512 tokens
  });
  
  return response.embeddings;  // Array of 768-dim vectors
}

// Rerank search results
async function rerankResults(query: string, docs: string[]) {
  const response = await cohere.rerank({
    query: query,
    documents: docs,
    model: 'rerank-english-v3.0',
    top_n: 5  // Return top 5 most relevant
  });
  
  return response.results;  // Sorted by relevance
}
```

---

### 4. Stripe (Payments)

**Integration:**
- Stripe Checkout (hosted payment page)
- Stripe Customer Portal (manage subscriptions)
- Webhooks (handle events)

**Workflow:**

```
1. User clicks "Upgrade to Pro"
2. API creates Stripe Checkout session
3. Redirect to Stripe-hosted page
4. User enters payment info
5. Stripe redirects to /success?session_id=...
6. Webhook confirms payment
7. Update user.subscription_tier = 'pro'
```

**Webhook Events:**
```typescript
// Handle Stripe webhooks
app.post('/api/webhooks/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
  
  switch (event.type) {
    case 'checkout.session.completed':
      // New subscription
      await createSubscription(event.data.object);
      break;
    
    case 'customer.subscription.updated':
      // Subscription changed (upgrade/downgrade)
      await updateSubscription(event.data.object);
      break;
    
    case 'customer.subscription.deleted':
      // Subscription canceled
      await cancelSubscription(event.data.object);
      break;
  }
  
  res.json({ received: true });
});
```

---

## 📊 Monitoring & Observability

### 1. Error Tracking: Sentry

```typescript
// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,  // 10% of transactions
});

// Capture errors
try {
  await indexProject(projectId);
} catch (error) {
  Sentry.captureException(error, {
    tags: { projectId },
    level: 'error'
  });
  throw error;
}
```

**Alerts:**
- Error rate >1% per hour
- Failed jobs >10% per hour
- API latency >2s (p95)

---

### 2. Uptime Monitoring: Betterstack

**Endpoints to Monitor:**
- `GET /api/health` (every 30 seconds)
- `GET /` (frontend, every 1 minute)

**Alerts:**
- Email + Slack if downtime >2 minutes
- PagerDuty for critical failures (enterprise tier)

---

### 3. Logging: Pino (structured JSON logs)

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',  // Pretty print in dev
    options: { colorize: true }
  }
});

// Usage
logger.info({ projectId, status: 'complete' }, 'Indexing finished');
logger.error({ error: err.message }, 'Failed to generate embeddings');
```

**Log Aggregation (Production):**
- Send logs to Betterstack Logs
- Retention: 30 days
- Full-text search enabled

---

## 🚀 Deployment Architecture

### Infrastructure (Fly.io)

**Apps:**

```
legacylens-api (Fastify server)
  ├─ Region: iad (US East)
  ├─ Instances: 2 (for HA)
  ├─ RAM: 1GB per instance
  ├─ Auto-scaling: 1-4 instances
  └─ Health check: /api/health

legacylens-worker (Background workers)
  ├─ Region: iad
  ├─ Instances: 1 (scale to 3 under load)
  ├─ RAM: 2GB (for repo cloning)
  └─ Processes:
      ├─ indexing.worker.js
      ├─ meeting.worker.js
      └─ embed.worker.js
```

**fly.toml (API server):**
```toml
app = "legacylens-api"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "8080"

[[services]]
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [services.concurrency]
    type = "connections"
    hard_limit = 1000
    soft_limit = 800

  [[services.http_checks]]
    interval = 10000
    timeout = 2000
    grace_period = "5s"
    method = "get"
    path = "/api/health"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 1024
```

---

### CI/CD Pipeline (GitHub Actions)

**Workflow:**

```yaml
# .github/workflows/deploy.yml
name: Deploy to Fly.io

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm test

  deploy-api:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --app legacylens-api
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}

  deploy-worker:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --app legacylens-worker
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

---

## 🔒 Security Considerations

### 1. Authentication
- JWT tokens (Supabase Auth)
- Token expiry: 1 hour (refresh token: 30 days)
- HTTPS only (enforce in production)

### 2. Authorization
- Role-based access (owner, member, viewer)
- Project-level permissions
- API key scoping (read-only, write)

### 3. Data Protection
- Encrypt sensitive data at rest (Supabase handles this)
- Encrypt GitHub tokens (AES-256)
- Auto-delete temp files after processing

### 4. Rate Limiting
```typescript
// Per user, per endpoint
const rateLimiter = {
  '/api/project/index': { limit: 5, window: '1h' },
  '/api/qa/ask': { limit: 100, window: '1h' },
  '/api/meeting/upload': { limit: 10, window: '1h' }
};
```

### 5. Input Validation
- Zod schemas for all inputs
- Sanitize file paths (prevent directory traversal)
- Max file size: 100MB (meetings), 50MB (repos via zip)

---

## 📈 Scalability Plan

### Current (MVP — 100 users)
- Fastify: 2 instances (handles 1,000 req/min)
- Workers: 1 instance (processes 10 repos/hour)
- PostgreSQL: Supabase free tier (500MB)
- Qdrant: Free tier (1M vectors)
- Redis: Upstash free tier (10K commands/day)

### Growth (1,000 users)
- Fastify: 4-6 instances (auto-scale)
- Workers: 3 instances (30 repos/hour)
- PostgreSQL: Supabase Pro ($25/mo, 8GB)
- Qdrant: Paid tier ($30/mo, 10M vectors)
- Redis: Upstash Pro ($10/mo)

### Scale (10,000 users)
- Fastify: 10+ instances (+ load balancer)
- Workers: 10 instances (separate by job type)
- PostgreSQL: Dedicated (Supabase Team, $100/mo)
- Qdrant: Self-hosted (Kubernetes)
- Redis: Self-hosted cluster

---

## 🧪 Testing Strategy

### Unit Tests
- Coverage target: >80%
- Framework: Vitest (faster than Jest)
- Run on every commit (GitHub Actions)

### Integration Tests
- Test tRPC endpoints (mocked DB)
- Test worker jobs (real Redis)
- Run on PR merge

### E2E Tests
- Framework: Playwright
- Critical flows:
  1. Sign up → connect repo → index
  2. Ask question → get answer
  3. Upload meeting → view transcript
- Run nightly (staging environment)

---

## 📚 Additional Documentation

- **API Reference:** See `API_DOCS.md`
- **Database Schema:** See `DATABASE.md`
- **Deployment Guide:** See `DEPLOYMENT.md`
- **Contributing Guide:** See `CONTRIBUTING.md`

---

**Next Steps:**
1. Review & approve architecture
2. Create detailed Low-Level Design (LLD)
3. Begin Phase 1 implementation (Weeks 1-2)

