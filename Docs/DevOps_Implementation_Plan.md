# DevOps Features — Implementation Plan

**Status:** Phase 1 & Phase 2 done  
**Doc:** [DevOps_Features_Proposal.md](./DevOps_Features_Proposal.md)

---

## Phase 1 — Foundation & high-value features

### Task 1.1 — Database: Incident model
- **What:** Add Prisma model `Incident` for post-incident learning.
- **Schema:** `id`, `projectId`, `summary`, `rootCause`, `filesChanged` (string[]), `resolution`, `createdAt`.
- **Deliverable:** Migration file, `npx prisma generate`.

### Task 1.2 — Service: incident.ts
- **What:** New service `src/server/services/incident.ts`.
- **Functions:**
  - `parseStackTrace(text: string)` → `{ filePath?, line?, message? }[]` (regex-based).
  - `getBlastRadiusFromGraph(architectureJson, filePath)` → `string[]` (dependents from graph edges).
  - `getIncidentContext(projectId, errorMessage?, ctx)` → assemble: search results, graph snippet, optional LLM runbook (uses existing search + llm).
  - `getRecentChangesForFile(projectId, filePath?, limit)` → query `Commit` by project, optionally filter by `filesChanged`.
- **Deliverable:** `incident.ts` with no new infra; uses prisma, search, llm.

### Task 1.3 — Router: devops.ts
- **What:** New tRPC router `src/server/routers/devops.ts`.
- **Procedures:**
  - `getBlastRadius` — input: `projectId`, `filePath`; returns `{ filePath, dependents, graphSnippet }`.
  - `getIncidentContext` — input: `projectId`, `errorMessage?`; returns context pack + optional runbook text.
  - `getRecentChanges` — input: `projectId`, `filePath?`, `limit?`; returns commits.
  - `getSafeChangeSuggestion` — input: `projectId`, `bugDescription`; returns suggested files + short LLM hint.
  - `listIncidents` — input: `projectId`; returns incidents.
  - `createIncident` — input: `projectId`, `summary`, `rootCause`, `filesChanged`, `resolution`.
  - `exportContext` — input: `projectId`, `filePath?`; returns markdown string.
- **Deliverable:** Router mounted in `routers/index.ts` under `devops`.

### Task 1.4 — UI: DevOps page and nav
- **What:** New page `src/pages/DevOps.tsx` at route `project/:id/devops`.
- **Sections:** Incident context (paste error), Blast radius (file picker), Recent changes, Safe change suggestion, Incident log (list + create).
- **Nav:** Add "DevOps" to `DashboardLayout` project nav items; add route in `App.tsx`.
- **Deliverable:** Page loads, calls tRPC; no breaking changes to existing pages.

### Task 1.5 — Tests
- **What:** Unit tests for `parseStackTrace`, `getBlastRadiusFromGraph`; integration-style test for devops router (mocked ctx).
- **Deliverable:** `src/server/services/incident.test.ts`, `src/server/routers/devops.test.ts` (or equivalent); `npm test` passes.

### Task 1.6 — Verification
- **What:** Run `npm run type-check`, `npm run lint`, `npm test`; fix any breakage in existing code (routers, services, app).
- **Deliverable:** All scripts pass; no regressions.

---

## Phase 2 — Done (on-demand)

- **Rollback/hotfix runbook** — `runbook.ts`: `detectRunbookFromIndexedFiles`; router: `detectRunbook`, `getRunbook`, `saveRunbook`; UI: Runbook tab + “Detect from repo” / Save.
- **Config / env map** — `detectEnvVarsFromEmbeddings` + `extractEnvVarsFromText`; router: `detectEnvVars`; UI: Config/Env tab + “Scan env vars”.
- **Incident replay** — `incident.ts`: `getCallPathFromStackTrace` (stack → entry … → failure); router: `getIncidentReplay`; UI: Call path tab + paste stack trace → “Show call path”.

---

## Task checklist

| # | Task | Status |
|---|------|--------|
| 1.1 | Prisma Incident model + migration | ✅ |
| 1.2 | incident.ts service | ✅ |
| 1.3 | devops router + mount | ✅ |
| 1.4 | DevOps page + route + nav | ✅ |
| 1.5 | Tests | ✅ |
| 1.6 | type-check, lint, test, fix regressions | ✅ |

**Note:** Run `npx prisma generate` (and `npx prisma migrate deploy` for a fresh DB) if the Prisma client was not regenerated. ESLint may need an `eslint.config.js` (v9) if you run lint; type-check and tests pass.
