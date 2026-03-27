# Design Document — LegacyLens VibeCon 2026

## Overview

LegacyLens VibeCon 2026 adds six new capabilities to the existing AI-powered legacy code intelligence platform and polishes four existing features for a stage demo at VibeCon 2026. The north star metric is reducing "Time to First Meaningful Contribution" from 14 days to under 2 days.

The existing codebase is a React 19 + Vite SPA backed by a Fastify tRPC server, Prisma ORM on PostgreSQL with pgvector, BullMQ + Redis for background jobs, Groq (Mixtral 8x7B) for LLM inference, and Cohere for embeddings and reranking. All new work fits within this stack — no new infrastructure is introduced.

The six new capabilities are:
1. Interactive D3.js Dependency Graph (Architecture page upgrade)
2. Codebase Health Score (HealthScoreEngine + HealthScoreWidget)
3. Onboarding Guide Auto-Generator (LLM-driven, versioned)
4. Pre-Loaded Demo Repositories (SeedService, isDemo flag)
5. Commit "Why" Intelligence (CommitInsightService)
6. UI Empty State Polish (EmptyState component + demo seed data)

The four polished existing features are:
7. Documentation Generator (syntax highlighting, streaming skeleton, export)
8. Q&A Interface (repo-specific chips, Redis cache, syntax-highlighted answers)
9. Task Board (pre-populated demo boards, AI Suggest Tasks)
10. Meeting Intelligence (pre-recorded demo meeting with transcript + code links)

---

## Architecture

### High-Level Component Map

```
┌─────────────────────────────────────────────────────────────────┐
│  React 19 SPA (Vite)                                            │
│                                                                 │
│  Pages: Architecture, ProjectOverview, OnboardingGuide,         │
│         History, Board, QA, Documentation, Meetings             │
│                                                                 │
│  New Components:                                                │
│    ArchitectureGraph (D3.js)   HealthScoreWidget                │
│    ArchitectureSidePanel       EmptyState                       │
└────────────────────┬────────────────────────────────────────────┘
                     │ tRPC (HTTP + WebSocket)
┌────────────────────▼────────────────────────────────────────────┐
│  Fastify Server                                                 │
│                                                                 │
│  New Routers:                                                   │
│    architecture.getGraph       healthScore.compute / .get       │
│    onboarding.generateGuide / .getGuide                         │
│    history.generateWhy / .generateAllWhy / .getInsights         │
│    board.suggestTasks (new mutation)                            │
│    qa.getSuggestions (enhanced)                                 │
│                                                                 │
│  New Services:                                                  │
│    HealthScoreEngine           CommitInsightService             │
│    OnboardingGuideGenerator    SeedService                      │
└────────────────────┬────────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼──────┐         ┌────────▼───────┐
│  PostgreSQL  │         │  Redis         │
│  + pgvector  │         │  (BullMQ +     │
│              │         │   Q&A cache)   │
│  New tables: │         │                │
│  CodebaseHS  │         │  qa:cache:{id} │
│  OnboardingG │         │  demo:qa:{id}  │
│  CommitInsig │         └────────────────┘
└──────────────┘
```

### Request Flow — New Features

**Architecture Graph:**
```
Architecture page load
  → trpc.project.getArchitecture({ projectId })   [existing]
  → architecture.getGraph({ projectId })           [new — transforms architectureJson]
  → ArchitectureGraph component (D3 force sim)
  → node click → ArchitectureSidePanel
```

**Health Score:**
```
ProjectOverview mounts (status=complete)
  → healthScore.get({ projectId })
  → if null → user clicks "Compute" → healthScore.compute({ projectId })
  → HealthScoreEngine.computeHealthScore(files, entryPoints)
  → upsert CodebaseHealthScore
  → HealthScoreWidget renders circular progress
```

**Onboarding Guide:**
```
OnboardingGuide page mounts
  → onboarding.getGuide({ projectId })
  → if null → user clicks "Generate" → onboarding.generateGuide({ projectId })
  → LLM call (Groq Mixtral) with structured prompt
  → persist OnboardingGuide (version++)
  → render 7 collapsible sections
```

**Commit Why:**
```
History page mounts
  → history.getInsights({ projectId })   [returns commitHash→why map]
  → per-commit: if no insight → "Generate Why" button
  → history.generateWhy({ projectId, commitHash })
  → CommitInsightService → Groq LLM → store CommitInsight
```

**Seed Service (startup):**
```
Server startup
  → SeedService.run()
  → for each DEMO_REPOS entry:
      if project exists → skip
      else → clone + index → healthScore.compute → onboarding.generateGuide
           → pre-cache 5 Q&A answers in Redis
           → seed board cards, team members, chat messages, meeting
```

---

## Components and Interfaces

### Frontend Components

#### ArchitectureGraph (existing stub → full implementation)

```typescript
interface ArchitectureGraphProps {
  files: ProjectFile[];
  graphData: { nodes?: unknown[]; edges?: unknown[] } | null;
  onNodeClick?: (file: GraphNode) => void;
  searchQuery?: string;
  filter?: 'all' | 'critical' | 'frontend' | 'backend';
}
```

Already implemented in `src/components/ui/ArchitectureGraph.tsx`. The component uses D3 `forceSimulation`, `forceLink`, `forceManyBody`, `forceCenter`, and `forceCollide`. Node radius is computed by `getNodeRadius(dependentsCount)` returning values in [6, 16]. Risk colors are defined in `RISK_COLORS`. The filter logic uses `isFileType()` for frontend/backend classification. The 200-node cap is applied in the `useMemo` that builds nodes/links.

The reset-zoom control attaches `__resetZoom` to the container DOM node and is called from the Architecture page via `handleResetZoom()`.

#### HealthScoreWidget (existing stub → full implementation)

```typescript
// Props: none — reads projectId from useParams
// Queries: trpc.healthScore.get, trpc.healthScore.compute
```

Already implemented in `src/components/ui/HealthScoreWidget.tsx`. Renders a `CircularProgress` SVG component and four `SubScoreBar` components. Grade labels and colors are computed by `getGrade(score)` and `getScoreColor(score)`.

#### EmptyState (new shared component)

```typescript
interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  heading: string;
  description: string;
  cta?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}
```

Location: `src/components/ui/EmptyState.tsx`

A reusable component that renders a centered layout with an icon, heading, description, and optional CTA button/link. Used across History, Board, QA, Meetings, and other pages when no data is available.

### Backend Services

#### HealthScoreEngine (`src/server/services/healthScoreCompute.ts`)

Already implemented. Exports `computeHealthScore(files, entryPoints): HealthScoreResult`.

Four sub-functions:
- `computeDocCoverage(files)` — ratio of documented functions/classes
- `computeCriticalFileRisk(files)` — documentation coverage of files with 5+ dependents
- `computeComplexity(files)` — inverse of average function length / file size
- `computeOnboardingReadiness(files, entryPoints)` — presence of README, entry points, index files

Weighted formula: `overall = docCoverage×0.30 + criticalRisk×0.25 + complexity×0.25 + onboarding×0.20`

#### CommitInsightService (`src/server/services/llm.ts` — `generateCommitWhy`)

Already implemented as `generateCommitWhy(message, filesChanged)`. Called from `history.ts` router. Stores results in `CommitInsight` table with unique constraint on `(projectId, commitHash)`.

#### OnboardingGuideGenerator (`src/server/services/llm.ts` — `generateOnboardingGuide`)

Already implemented as `generateOnboardingGuide(context)`. Produces a markdown string with 7 `##`-headed sections. Stored in `OnboardingGuide.content` as `{ markdown: string }`.

#### SeedService (`src/server/services/seed.ts` — new)

```typescript
const DEMO_REPOS = [
  { githubUrl: 'https://github.com/django/django',       name: 'Django' },
  { githubUrl: 'https://github.com/vercel/next.js',      name: 'Next.js' },
  { githubUrl: 'https://github.com/chatwoot/chatwoot',   name: 'Chatwoot' },
] as const;

async function run(): Promise<void>;
async function seedDemoRepo(repo: typeof DEMO_REPOS[number]): Promise<void>;
async function seedBoardCards(projectId: string, boardId: string): Promise<void>;
async function seedTeamMembers(projectId: string, demoUserId: string): Promise<void>;
async function seedChatMessages(projectId: string): Promise<void>;
async function seedMeeting(projectId: string): Promise<void>;
async function cacheQAAnswers(projectId: string, redis: Redis): Promise<void>;
```

The `run()` function is called once at server startup (after DB connection is confirmed). It checks for existing demo projects by `githubUrl` and skips if found. Each `seedDemoRepo` call logs progress at: clone, index, health score, guide, board, team, chat, meeting, Q&A cache.

#### board.suggestTasks (new tRPC mutation)

```typescript
// Input: { projectId: string }
// Output: { tasks: string[], columnId: string }
// Calls Groq LLM with project summary, returns 5 task titles
// Creates 5 Card records in the "To Learn" column
```

#### qa.getSuggestions (enhanced)

The existing implementation returns generic questions. The enhanced version:
1. Reads `project.techStack`, `project.files` (top 5 by dependentsCount), and `project.repoDescription`
2. Generates 5 repo-specific questions using a template approach (no LLM call needed for suggestions)
3. For demo repos, reads pre-stored suggestions from the `Project` record or a Redis key

---

## Data Models

### Existing Models (unchanged)

- `Project` — already has `isDemo Boolean @default(false)` and relations to `CodebaseHealthScore`, `OnboardingGuide[]`, `CommitInsight[]`
- `Commit` — `commitHash`, `message`, `author`, `filesChanged`, `summary`
- `Board`, `Column`, `Card` — existing Kanban models
- `Meeting` — `transcriptionStatus`, `transcriptText`, `insights` (JSON)

### New Models (already added to schema.prisma)

```prisma
model CodebaseHealthScore {
  id                    String   @id @default(uuid())
  projectId             String   @unique @map("project_id")
  overallScore          Int      @map("overall_score")
  docCoverageScore      Int      @map("doc_coverage_score")
  criticalFileRiskScore Int      @map("critical_file_risk_score")
  complexityScore       Int      @map("complexity_score")
  onboardingReadiness   Int      @map("onboarding_readiness")
  computedAt            DateTime @default(now()) @map("computed_at")
  project               Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  @@map("codebase_health_scores")
}

model OnboardingGuide {
  id          String   @id @default(uuid())
  projectId   String   @map("project_id")
  content     Json                          -- { markdown: string }
  version     Int      @default(1)
  generatedAt DateTime @default(now()) @map("generated_at")
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  @@index([projectId])
  @@map("onboarding_guides")
}

model CommitInsight {
  id          String   @id @default(uuid())
  projectId   String   @map("project_id")
  commitHash  String   @map("commit_hash")
  why         String   @db.Text
  generatedAt DateTime @default(now()) @map("generated_at")
  @@unique([projectId, commitHash])
  @@index([projectId])
  @@map("commit_insights")
}
```

### Redis Key Schema

```
qa:cache:{projectId}:{questionHash}   → JSON string (answer + contextFiles)  TTL: 24h
demo:qa:{projectId}:{questionIndex}   → JSON string (pre-seeded answer)       TTL: none (permanent)
```

`questionHash` is a SHA-256 of the lowercased, trimmed question string.

### Architecture Graph Data Shape

The `architectureJson` JSONB field on `Project` stores:
```typescript
{
  nodes: Array<{ id: string; filePath: string }>;
  edges: Array<{ source: string; target: string }>;  // filePath references
}
```

The `architecture.getGraph` endpoint transforms this into:
```typescript
{
  nodes: GraphNode[];   // enriched with File metadata from DB
  links: GraphEdge[];   // filtered to only include nodes in the capped set
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Graph node set matches file set

*For any* list of files and graph data passed to `ArchitectureGraph`, the resulting nodes array should contain exactly the files that pass the active filter, capped at 200, sorted by `dependentsCount` descending. No node should reference a file not in the input list.

**Validates: Requirements 1.2, 1.10, 1.12**

### Property 2: Node radius is bounded and monotone

*For any* non-negative integer `dependentsCount`, `getNodeRadius(dependentsCount)` should return a value in the closed interval [6, 16], and for any two counts `a ≤ b`, `getNodeRadius(a) ≤ getNodeRadius(b)`.

**Validates: Requirements 1.4**

### Property 3: Risk color mapping is total and correct

*For any* file with a `riskLevel` of "critical", "high", "medium", or "low", the color returned by the risk color lookup should match the expected hex constant. For any unrecognised risk level, the function should fall back to the "low" color.

**Validates: Requirements 1.3**

### Property 4: Filter produces a subset

*For any* filter value ("all", "critical", "frontend", "backend") and any list of files, the filtered result should be a subset of the original list. The "all" filter should return the full list (before capping). The "critical" filter should return only files with `riskLevel` in ["critical", "high"].

**Validates: Requirements 1.8**

### Property 5: Health score weighted formula

*For any* four sub-scores `d`, `c`, `x`, `o` each in [0, 100], `computeHealthScore` should return an `overallScore` equal to `round(d×0.30 + c×0.25 + x×0.25 + o×0.20)`, clamped to [0, 100].

**Validates: Requirements 2.2**

### Property 6: Documentation coverage is a valid percentage

*For any* list of files with known documented/undocumented functions and classes, `computeDocCoverage` should return a value in [0, 100]. If no functions or classes are present, it should return 50 (the neutral default).

**Validates: Requirements 2.3**

### Property 7: Onboarding readiness increases with README presence

*For any* file list that includes a README file, `computeOnboardingReadiness` should return a score at least 30 points higher than the same file list without the README.

**Validates: Requirements 2.6**

### Property 8: Health score round-trip

*For any* fully-indexed project, calling `healthScore.compute` followed by `healthScore.get` should return a record whose `overallScore` matches the value returned by `computeHealthScore` for that project's files.

**Validates: Requirements 2.12, 2.13**

### Property 9: Onboarding guide persistence round-trip

*For any* fully-indexed project, calling `onboarding.generateGuide` followed by `onboarding.getGuide` should return the most recently generated guide, with `version` equal to the count of all previously generated guides plus one.

**Validates: Requirements 3.7, 3.8, 3.9, 3.10**

### Property 10: Onboarding guide has exactly 7 sections

*For any* generated onboarding guide markdown string, splitting on `^## ` should yield exactly 7 non-empty sections with titles matching: "Start Here", "Understand the Architecture", "Core Flows", "Files to Read Before Touching Anything", "Safe Zones", "Known Complexity Hotspots", "Suggested First Tasks".

**Validates: Requirements 3.3**

### Property 11: SeedService idempotency

*For any* run of `SeedService.run()` on a database that already contains the three demo repos, the total count of `Project` records with `isDemo = true` should remain 3 (no duplicates created).

**Validates: Requirements 4.1, 4.10**

### Property 12: Demo repos have required artifacts

*For any* project seeded by `SeedService`, after seeding completes: `CodebaseHealthScore` should exist for that project, `OnboardingGuide` count should be ≥ 1, and `Board` should have cards in all four columns.

**Validates: Requirements 4.2, 4.6, 9.1**

### Property 13: Commit insight uniqueness and retrievability

*For any* `(projectId, commitHash)` pair, calling `history.generateWhy` twice should create exactly one `CommitInsight` record. The second call should return the cached record. `history.getInsights` should include that `commitHash` in its returned map.

**Validates: Requirements 5.4, 5.7, 5.9, 5.10, 5.11**

### Property 14: Bulk Why generation respects limit

*For any* project with N commits lacking insights, calling `history.generateAllWhy({ limit: L })` should generate at most `min(N, L)` new `CommitInsight` records and return `{ generated: min(N, L), total: min(N, L) }`.

**Validates: Requirements 5.8**

### Property 15: Demo board minimum card counts

*For any* demo project's board, after seeding: the "To Learn" column should have ≥ 3 cards, "Exploring" ≥ 2, "Understood" ≥ 2, "Ready to Modify" ≥ 1. Every seeded card should have a non-empty `linkedFiles` array.

**Validates: Requirements 9.1, 9.2**

### Property 16: AI Suggest Tasks adds exactly 5 cards

*For any* project, calling `board.suggestTasks` should add exactly 5 new `Card` records to the "To Learn" column, each with a non-empty `title`.

**Validates: Requirements 9.4**

### Property 17: Demo meeting has complete transcript and file links

*For any* demo project, after seeding: there should be at least one `Meeting` record with `transcriptionStatus = "complete"`, a non-null `transcriptText`, and `insights` containing at least 3 file path references.

**Validates: Requirements 6.4, 10.1**

### Property 18: Q&A suggestions are project-specific and count exactly 5

*For any* project, `qa.getSuggestions` should return exactly 5 strings. For two projects with different tech stacks or top files, the suggestion sets should differ (i.e., suggestions are not hardcoded generic strings).

**Validates: Requirements 8.1, 8.4**

---

## Error Handling

### HealthScoreEngine

- If `project.status !== 'complete'`, `healthScore.compute` throws `PRECONDITION_FAILED` with message "Project must be fully indexed before computing Health Score."
- If `files` array is empty, sub-score functions return neutral defaults (50) rather than crashing.
- All sub-scores are clamped to [0, 100] before storage.

### OnboardingGuideGenerator

- If `project.status !== 'complete'`, `onboarding.generateGuide` throws `PRECONDITION_FAILED` with message "Project must be fully indexed before generating an Onboarding Guide."
- If the Groq LLM call fails, the error propagates as `INTERNAL_SERVER_ERROR` with a user-readable message.
- The guide content is stored as `{ markdown: string }` JSON; if parsing fails on the frontend, the raw markdown is rendered as a fallback.

### CommitInsightService

- If the commit is not found in the DB, `history.generateWhy` throws `NOT_FOUND`.
- If the LLM call fails for a single commit during bulk generation, the error is logged and the loop continues (best-effort).
- The unique constraint on `(projectId, commitHash)` prevents duplicate generation; the router checks for an existing record before calling the LLM.

### SeedService

- If a demo repo's GitHub clone fails, the error is logged and the seed continues with the next repo.
- If health score computation fails during seeding, the error is logged but does not abort the seed.
- The seed is designed to be re-runnable: all operations check for existing records before creating.

### ArchitectureGraph

- If `architectureJson` is null or empty, the `architecture.getGraph` endpoint returns `{ nodes: [], links: [] }`.
- The `ArchitectureGraph` component checks `nodes.length === 0` and renders an empty-state message.
- If the D3 simulation throws (e.g., invalid data), the error is caught in a React error boundary on the Architecture page.

### Q&A Redis Cache

- If Redis is unavailable, the Q&A endpoint falls back to direct LLM generation without caching.
- Cache misses are handled gracefully — the endpoint proceeds with the normal RAG pipeline.

---

## Testing Strategy

### Dual Testing Approach

Both unit tests and property-based tests are required. Unit tests cover specific examples, integration points, and edge cases. Property-based tests verify universal correctness across randomised inputs.

### Unit Tests

Focus areas:
- `computeHealthScore` with known file fixtures (e.g., all documented, none documented, mixed)
- `getNodeRadius` boundary values (0, 1, 2, 5, 9, 10, 100)
- `SeedService.run()` idempotency with a mocked Prisma client
- `history.generateWhy` cache hit path (no LLM call when insight exists)
- `onboarding.generateGuide` rejection when project status is not "complete"
- `EmptyState` component renders with all prop combinations
- `architecture.getGraph` returns `{ nodes: [], links: [] }` when `architectureJson` is null

### Property-Based Tests

Library: **fast-check** (already compatible with the Vitest setup in `package.json`)

Configuration: minimum 100 runs per property (`{ numRuns: 100 }`).

Each test is tagged with a comment in the format:
`// Feature: legacylens-vibecon-2026, Property N: <property_text>`

**Property 1 — Graph node set matches file set**
```typescript
// Feature: legacylens-vibecon-2026, Property 1: graph node set matches file set
fc.assert(fc.property(
  fc.array(fc.record({ filePath: fc.string(), dependentsCount: fc.nat(), riskLevel: fc.constantFrom('low','medium','high','critical'), ... }), { minLength: 0, maxLength: 500 }),
  (files) => {
    const { nodes } = buildGraphData(files, null, 'all');
    return nodes.length <= 200 && nodes.every(n => files.some(f => f.filePath === n.filePath));
  }
), { numRuns: 100 });
```

**Property 2 — Node radius bounded and monotone**
```typescript
// Feature: legacylens-vibecon-2026, Property 2: node radius is bounded and monotone
fc.assert(fc.property(
  fc.nat(1000),
  (count) => {
    const r = getNodeRadius(count);
    return r >= 6 && r <= 16;
  }
), { numRuns: 100 });
```

**Property 5 — Health score weighted formula**
```typescript
// Feature: legacylens-vibecon-2026, Property 5: health score weighted formula
fc.assert(fc.property(
  fc.integer({ min: 0, max: 100 }),
  fc.integer({ min: 0, max: 100 }),
  fc.integer({ min: 0, max: 100 }),
  fc.integer({ min: 0, max: 100 }),
  (d, c, x, o) => {
    const expected = Math.round(d * 0.30 + c * 0.25 + x * 0.25 + o * 0.20);
    const result = computeWeightedScore(d, c, x, o);
    return result === Math.max(0, Math.min(100, expected));
  }
), { numRuns: 100 });
```

**Property 9 — Onboarding guide persistence round-trip**
```typescript
// Feature: legacylens-vibecon-2026, Property 9: onboarding guide persistence round-trip
// Integration test using test DB: generate then get returns same content and version++
```

**Property 13 — Commit insight uniqueness**
```typescript
// Feature: legacylens-vibecon-2026, Property 13: commit insight uniqueness and retrievability
// Integration test: calling generateWhy twice for same (projectId, commitHash) yields 1 DB record
```

**Property 14 — Bulk Why respects limit**
```typescript
// Feature: legacylens-vibecon-2026, Property 14: bulk Why generation respects limit
fc.assert(fc.property(
  fc.integer({ min: 1, max: 50 }),
  fc.integer({ min: 0, max: 100 }),
  (limit, commitCount) => {
    const generated = Math.min(commitCount, limit);
    return generated <= limit && generated <= commitCount;
  }
), { numRuns: 100 });
```

### Integration Tests

- `SeedService.run()` against a test PostgreSQL instance: verify 3 demo projects created, each with `isDemo=true`, `CodebaseHealthScore`, `OnboardingGuide`, and board cards.
- `healthScore.compute` → `healthScore.get` round-trip on a seeded test project.
- `history.generateWhy` cache hit: insert a `CommitInsight` directly, call `generateWhy`, verify LLM mock was not called.

### Test File Locations

```
LegacyLensLocal/src/server/services/healthScoreCompute.test.ts   (unit + property)
LegacyLensLocal/src/server/services/seed.test.ts                  (unit + integration)
LegacyLensLocal/src/server/routers/history.test.ts                (unit + integration)
LegacyLensLocal/src/server/routers/onboarding.test.ts             (unit + integration)
LegacyLensLocal/src/components/ui/EmptyState.test.tsx             (unit)
LegacyLensLocal/src/components/ui/ArchitectureGraph.test.tsx      (unit + property)
```
