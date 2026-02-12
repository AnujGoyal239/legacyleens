# DevOps Features Proposal — LegacyLens

**Purpose:** Help teams (especially juniors on-call) fix production breakages quickly, **surgically**, and without disturbing other services. Reduce time-to-fix and cost of midnight incidents.

**Core idea:** LegacyLens already has **codebase intelligence** (dependency graph, embeddings, AI Q&A). We extend it into **incident intelligence** — so "what broke?" and "what’s safe to change?" are answered from the same platform.

---

## 1. Incident Runbook / On-Call Helper (High impact, fits your idea)

**Problem:** At 2 AM, a junior gets an alert. They don’t know which service failed, what depends on it, or what to do first.

**Feature:**
- **Incident context in one place:** User pastes an error message or selects a service/endpoint. LegacyLens:
  - Finds the relevant code (existing search/embeddings).
  - Shows **dependency graph** for that service (existing analyzer).
  - Suggests **“likely culprits”** (recently changed files, or files that match the error).
  - Optionally: **AI-generated runbook** (e.g. “Check DB connection → Restart worker → Rollback if X.”).
- **“Who to wake up” hint:** From code ownership or file paths, suggest “this area is usually owned by Team X” (if you add ownership metadata later).

**Why it fits:** Uses existing index, graph, and LLM. New UI: e.g. “Incident Helper” or “On-Call” tab where you paste error / pick service and get the context pack.

---

## 2. Blast Radius / Impact Map (Surgical fixes)

**Problem:** Junior fixes one file and deploys — then three other services break because they depended on that change.

**Feature:**
- **Before making a change:** User selects a file (or a list of files). LegacyLens shows:
  - **“Blast radius”:** All files/services that **depend on** this file (downstream impact).
  - **“If you change this, these N places are affected”** with links to code.
- **Optional:** “Safe change set” — AI suggests **minimal set of files** to change to fix a described bug, with a warning like “Changing anything else may affect Auth and Billing.”

**Why it fits:** You already have `dependentsMap` and dependency graph in `analyzer.ts`. This is mostly a new view + optional LLM step for “minimal fix set.”

---

## 3. Safe-Change Suggestions (AI-powered surgical fix)

**Problem:** Junior doesn’t know the smallest change that will fix the issue without touching unrelated code.

**Feature:**
- User describes the bug or pastes the error (e.g. “Login fails with 500 after Redis timeout”).
- LegacyLens:
  - Uses RAG to find relevant code (existing Q&A pipeline).
  - Uses dependency graph to **exclude** high-risk or unrelated areas.
  - **AI suggests:** “Limit changes to these 2–3 files; avoid touching X and Y because they affect payments.”
- Output: Short list of files + one-paragraph “surgical fix” suggestion (and link to existing Q&A for “why does this code do X?”).

**Why it fits:** Composes existing search, embeddings, analyzer, and LLM. New: “Surgical fix” mode in Q&A or a dedicated “Fix suggestion” flow.

---

## 4. Rollback / Hotfix Playbook (Reduce panic)

**Problem:** When things break, juniors don’t know how to rollback or deploy a hotfix for this specific repo.

**Feature:**
- **Per-project “Runbooks”:** Stored in LegacyLens (or inferred from repo).
- **Auto-generated hints:** Scan repo for `docker-compose`, `Dockerfile`, `k8s/`, `scripts/`, CI configs. Show:
  - “How to rollback” (e.g. “Revert last deploy: `./scripts/rollback.sh` or `kubectl rollout undo`”).
  - “How to deploy a hotfix” (e.g. “Build and push image, then run X”).
- **AI summary:** “For this project, rollback usually means: 1. … 2. …” so the on-call person has a single place to look.

**Why it fits:** Parser already sees file structure; you can add a small “runbook detector” and store snippets. Optional: let users edit/correct runbooks so they improve over time.

---

## 5. Post-Incident Learning (Long-term)

**Problem:** Same kind of incident happens again; nobody remembers what fixed it last time.

**Feature:**
- **Incident log (lightweight):** For a project, users can record: “At [date], [service/area] broke. Root cause: X. Fix: we changed files A, B.”
- **Next time:** When someone asks about the same area or a similar error, LegacyLens can say: “Last time something similar happened (e.g. Auth service), the fix was …” with link to code/files.
- Stored in DB (e.g. `Incident` table: projectId, summary, rootCause, filesChanged, resolution).

**Why it fits:** Builds on existing project + code linking. Turns LegacyLens into the “institutional memory” for incidents as well as for code.

---

## 6. Dependency-Aware Deploy Order (Optional, for multi-service repos)

**Problem:** Team deploys service A then B, but B depends on A; wrong order causes brief breakage.

**Feature:**
- For repos with multiple deployable units (e.g. several `Dockerfile`s or k8s services), LegacyLens infers dependency order from code (imports, API calls).
- **“Suggested deploy order”:** e.g. “Deploy: 1. auth-service, 2. api-gateway, 3. workers” so dependents go after dependencies.
- Can live in the same “DevOps Helper” or “Deploy” view.

**Why it fits:** Same dependency graph; just add a “deployable unit” concept (e.g. by folder or Dockerfile) and topological sort.

---

## Ideas from our side (beyond the runbook / blast-radius)

These are additional directions we think could make the “midnight fix” experience much better, from first alert to long-term resilience.

### 7. Failure fingerprint — stack trace → exact code

**Problem:** Junior gets a stack trace or log line and doesn’t know which repo, which file, or which line to open first.

**Idea:** Paste stack trace or error message → LegacyLens maps it to **exact file + line** in the indexed codebase. Show: “This error is thrown only in `src/server/auth.ts` line 47” plus the surrounding code and **who calls it**. So the first step (“where do I look?”) is one click, not 20 minutes of grepping.

**Builds on:** Code index, optional stack-trace parsing (regex or simple parser), existing “who depends on this” from analyzer.

---

### 8. “What changed before it broke?”

**Problem:** First question in any incident: “What changed?” Juniors waste time digging through Git.

**Idea:** For a given **service, folder, or file**, show “last N commits that touched this” (e.g. last 24h or last 5 commits). One view: “These 3 commits touched auth in the last day.” Integrate with GitHub (you already have it) so it’s in-app. When something breaks at midnight, “what changed?” is answered in one click.

**Builds on:** GitHub integration, project → repo mapping. New: “recent changes” API + UI per module/file.

---

### 9. Silent-failure hotspots

**Problem:** Many incidents are “it just stopped working” — no clear error because failures were swallowed or not logged.

**Idea:** Scan the codebase for **risky patterns**: empty `catch` blocks, `catch (e) {}`, unhandled promise rejections, external calls with **no timeout**, missing retries on critical paths. Produce a “risk list” per project: “These 12 places might fail silently in production.” Use it in two ways: (1) **proactively** fix before incidents; (2) **during incident** — “this area has 2 known silent-failure spots, check those first.”

**Builds on:** Parser/AST (you already parse files). New: pattern rules (e.g. detect empty catch, fetch without timeout) and a “risk report” view.

---

### 10. Config / env map

**Problem:** A lot of midnight issues are config: wrong env var, missing secret, wrong endpoint. Nobody knows “where does this service read REDIS_URL?”

**Idea:** Scan for `process.env.*`, config files, `.env.example`. For each **service or entrypoint**, show: “This service uses these 8 env vars; here’s where each is read in code.” Runbook can then say: “If Redis is down, check LEGACYLENS_REDIS_URL; it’s used in `src/server/redis.ts` and `workers/index.ts`.” Reduces “which env var?” guesswork at 2 AM.

**Builds on:** Parser + file index. New: env/config extraction and a small “config map” per project or service.

---

### 11. Incident replay (call path from failure)

**Problem:** Junior sees “error in Billing” but doesn’t see the path: how did the request get there?

**Idea:** User pastes a **stack trace** or a **sequence of log lines**. LegacyLens reconstructs the **call path**: e.g. “Request → Auth → API → Billing → DB; failure at Billing line 22.” Show it as a **mini architecture diagram** or a linear “request path” so the on-call person sees not just the failing line but the path through the system. Helps with “why did this endpoint trigger that code?”

**Builds on:** Stack trace parsing + dependency/call graph (you have imports; could extend to “who calls this function” if you add a bit of call analysis). New: “failure path” view.

---

### 12. Same-bug search

**Problem:** The same kind of bug often exists in multiple places (e.g. same Redis pattern, same missing null check). Fixing one place leaves the others for the next incident.

**Idea:** When the user describes a bug or pastes an error, search not only “where is this handled?” but **“similar code patterns”** in the codebase. “3 other files use the same `Redis.get` pattern without timeout; one of them might have the same bug.” Surfaces “fix all similar spots” so one incident turns into one cleanup, not repeated incidents.

**Builds on:** Embeddings + search (similar code), optional incident log (“we fixed this pattern in X last month”). New: “similar pattern” mode in search or in the incident flow.

---

### 13. One-click context export (for Slack / PagerDuty)

**Problem:** Person gets paged; they want to hand off or get help. Copy-pasting links and context is messy.

**Idea:** “Export incident context” → generate a **single link or markdown pack** with: architecture snippet for the failing area, recent commits there, blast radius for the file(s) in question, runbook summary. That link can go into Slack, PagerDuty, or email so the next person (or senior) has one place to catch up. Reduces “what’s going on?” back-and-forth.

**Builds on:** All of the above (context, blast radius, recent changes, runbook). New: export endpoint + shareable link or rendered markdown.

---

### 14. Timeout & retry map

**Problem:** “Service is hanging” often means an external call (DB, Redis, third-party API) has no timeout or retry. Finding all such calls is tedious.

**Idea:** Map all **external calls** (fetch, axios, DB client, Redis) and flag: “no timeout,” “no retry,” “sync call in async path.” Show a **timeout/retry map** per project. When the incident is “everything is stuck,” the helper suggests: “These 5 external calls have no timeout; check them first.” Complements silent-failure hotspots with a focus on “where can we hang?”

**Builds on:** Parser/AST. New: rules for “external call + timeout/retry” and a dedicated view or section in the risk report.

---

## Suggested “DevOps Helper” product slice

Package the above into a **DevOps Helper** (or **Incident Helper**) experience inside LegacyLens:

| Capability              | What the user gets |
|-------------------------|--------------------|
| **Incident context**    | Paste error / pick service → get code, graph, runbook hints. |
| **Blast radius**        | Select file(s) → see what will be affected by a change. |
| **Safe-change suggestion** | Describe bug → get minimal file set + short fix hint. |
| **Rollback / hotfix**   | Per-project rollback and hotfix steps (from repo or manual). |
| **Incident memory**     | Log what broke and how it was fixed → reuse next time. |
| **Failure fingerprint** | Paste stack trace → exact file/line + who calls it. |
| **What changed?**       | Last N commits that touched this service/file (from GitHub). |
| **Silent-failure hotspots** | List of risky patterns (empty catch, no timeout) to fix or check first. |
| **Config / env map**    | Per service: which env vars, where they’re read in code. |
| **Incident replay**     | Stack trace → reconstructed call path (mini architecture). |
| **Same-bug search**     | “Similar code patterns” so you fix all similar spots. |
| **Context export**      | One link or markdown pack for Slack/PagerDuty handoff. |
| **Timeout / retry map** | External calls with no timeout or retry → “check these first” when things hang. |

**Phasing:**
- **Phase 1 (fast win):** Blast radius view (reuse analyzer) + Incident context (search + graph + one runbook-style prompt) + **Failure fingerprint** (stack trace → file/line).
- **Phase 2:** Safe-change suggestions (RAG + graph + LLM) + rollback/hotfix detection + **What changed?** (GitHub recent commits) + **Config / env map**.
- **Phase 3:** Incident log + “last time we fixed this…” + **Silent-failure hotspots** + **Timeout/retry map** + optional **Context export** and **Incident replay**.

---

## Technical hooks already in LegacyLens

- **`analyzer.ts`:** Dependency graph, dependents, risk levels → blast radius, deploy order.
- **`search.ts` + embeddings + LLM:** RAG for “where is this error handled?” and “what’s the minimal fix?”.
- **`project` router + repo indexing:** Already have files and structure → runbook detection, incident ↔ project linking.
- **New:** Small “incident” or “runbook” storage (e.g. Prisma models), and a **DevOps/Incident** router + UI tab.

---

## Summary

- **DevOps Helper** = one place for **incident context**, **blast radius**, **safe-change suggestions**, **rollback/hotfix playbooks**, and **incident memory**.
- Juniors get **context and guardrails** (what not to touch, what to change first) so fixes are **surgical** and **faster**, with less risk of breaking other services.
- Everything reuses LegacyLens’s existing codebase intelligence; the main additions are new views, optional storage for runbooks/incidents, and a few new prompts/flows.

If you want to start with code, the highest-leverage first step is **Blast Radius** (analyzer already has the data) plus **Incident context** (search + graph + one runbook-style LLM call).

**In short:** Your idea = runbook + blast radius + surgical fixes. Our add-ons = **find the exact failure** (fingerprint, replay), **answer “what changed?”** (Git), **find hidden risks** (silent failures, timeouts, config map), **fix everywhere** (same-bug search), and **hand off in one click** (context export). Together they cover “from first alert to resolved” without waking the whole team.

---

## Do we need to change the architecture?

**Short answer: No.** You can implement all of this inside your **existing modular monolith**. No new runtimes, no new infrastructure, no move to microservices.

### What stays the same

| Layer | Today | With DevOps features |
|-------|------|----------------------|
| **App** | Single Fastify + tRPC server | Same; one extra router (e.g. `devops` or `incident`) |
| **Services** | `analyzer`, `search`, `github`, `llm`, `parser`, … | Same + 1–3 new services (e.g. `incident`, `runbook`, `riskScanner`) |
| **Workers** | BullMQ (indexing, transcription) | Same; optional new job type (e.g. `scan:risks`) in the same worker process |
| **DB** | PostgreSQL (Prisma) | Same; add a few tables (e.g. `Incident`, `ProjectRunbook`) |
| **Cache/Queue** | Redis | Same |
| **Deploy** | One app + one worker (e.g. Docker / Fly.io) | Same |

### How the new pieces fit (no new boxes)

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXISTING FASTIFY + tRPC                       │
│                                                                  │
│  Routers:  auth | project | qa | meeting | board | billing       │
│            + devops  ← NEW (incident context, blast radius, …)   │
│                                                                  │
│  Services: analyzer | search | github | llm | parser | …         │
│            + incidentService  ← NEW (stack trace, context pack)   │
│            + riskScanner      ← NEW (optional; silent-fail, env) │
└─────────────────────────────────────────────────────────────────┘
                              │
              Same PostgreSQL │ Same Redis │ Same BullMQ
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    EXISTING WORKERS (BullMQ)                     │
│  index:repo | meeting:proc | embed:batch                         │
│            + scan:risks  ← OPTIONAL (background risk scan)       │
└─────────────────────────────────────────────────────────────────┘
```

### What you actually add

1. **One new router** — e.g. `src/server/routers/devops.ts` (or `incident.ts`) with procedures: `getIncidentContext`, `getBlastRadius`, `getSafeChangeSuggestions`, `getRecentChanges`, `exportContext`, etc. Mount it in `routers/index.ts` next to `project`, `qa`, `meeting`.

2. **One or two new services** — e.g. `src/server/services/incident.ts` (stack-trace parsing, assemble context from search + analyzer + LLM), and optionally `riskScanner.ts` (AST patterns for empty catch, env usage, timeouts). These call existing `analyzer`, `search`, `llm`, `github` — no new infrastructure.

3. **New Prisma models (same DB)** — e.g. `Incident` (projectId, summary, rootCause, filesChanged, resolution, createdAt), optionally `ProjectRunbook` (projectId, rollbackSteps, hotfixSteps, envVars). Then `npx prisma migrate dev` as usual.

4. **Optional background job** — If you want “silent-failure scan” or “timeout map” to run on a schedule or after index, add a job type like `scan:risks` in the same worker that runs `index:repo`. Same Redis queue, same worker process.

5. **New UI** — One new section or tab (e.g. “DevOps” or “Incident helper”) in the dashboard that calls the new tRPC procedures. Same React app, same auth.

### When you *would* change architecture

- If DevOps features grow a **separate team** and need independent deploy/scaling (then you’d extract an “Incident Service” as its own service).
- If **risk scanning** or **stack-trace parsing** becomes very heavy (e.g. millions of files) and you need a dedicated worker pool — you’d still just add worker processes, not redesign the system.
- For the scope in this doc, **staying in the monolith is the right call**: simpler ops, one deploy, shared code (analyzer, search, LLM) with no network boundaries.

**Summary:** Implement DevOps features as **new modules inside the existing architecture** — one router, a few services, a couple of tables, optional job type. No architecture change required.
