# Implementation Plan: LegacyLens VibeCon 2026

## Overview

Implement six new capabilities and polish four existing features in priority order. The codebase already has stub/partial implementations for most components — tasks focus on completing, wiring, and testing each feature. All routers are registered; all three Prisma models exist in the schema. The implementation language is TypeScript (React 19 + Fastify tRPC).

---

## Tasks

- [x] 1. Database migration — add new models to PostgreSQL
  - Run `prisma migrate dev` to create the `codebase_health_scores`, `onboarding_guides`, and `commit_insights` tables from the existing schema
  - Verify `isDemo` column exists on `projects` table
  - _Requirements: 2.12, 3.8, 4.2, 5.10_

- [x] 2. Architecture Dependency Graph — complete `architecture.getGraph` tRPC endpoint
  - [x] 2.1 Add `architecture` router with `getGraph` procedure to `src/server/routers/`
    - Input: `{ projectId: string }`
    - Read `project.architectureJson` from DB; if null return `{ nodes: [], links: [] }`
    - Enrich each node with `File` metadata (riskLevel, dependentsCount, linesOfCode, isEntryPoint) via a single `prisma.file.findMany` call
    - Filter links to only include both-endpoint nodes in the enriched set
    - Register the new router in `src/server/routers/index.ts`
    - _Requirements: 1.12, 1.13_

  - [x]* 2.2 Write unit tests for `architecture.getGraph`
    - Test: null `architectureJson` → `{ nodes: [], links: [] }`
    - Test: nodes are enriched with File metadata
    - Test: links referencing missing nodes are dropped
    - _Requirements: 1.12, 1.13_

  - [x] 2.3 Wire `ArchitectureGraph` component to use `architecture.getGraph` on the Architecture page
    - Replace the existing `data?.graph` pass-through in `Architecture.tsx` with a call to `trpc.architecture.getGraph.useQuery({ projectId })`
    - Pass the enriched `nodes` and `links` to `ArchitectureGraph` as `graphData`
    - Show the existing empty-state message when `nodes.length === 0`
    - _Requirements: 1.1, 1.2, 1.13_

  - [x]* 2.4 Write property test for graph node set (Property 1)
    - **Property 1: Graph node set matches file set**
    - **Validates: Requirements 1.2, 1.10, 1.12**
    - File: `src/components/ui/ArchitectureGraph.test.tsx`
    - Use `fast-check` to generate random file arrays (0–500 items) and assert `nodes.length <= 200` and every node's `filePath` exists in the input
    - Tag: `// Feature: legacylens-vibecon-2026, Property 1`

  - [x]* 2.5 Write property test for node radius (Property 2)
    - **Property 2: Node radius is bounded and monotone**
    - **Validates: Requirements 1.4**
    - File: `src/components/ui/ArchitectureGraph.test.tsx`
    - Use `fast-check` with `fc.nat(1000)` to assert `getNodeRadius(n) >= 6 && getNodeRadius(n) <= 16`
    - Tag: `// Feature: legacylens-vibecon-2026, Property 2`

  - [x]* 2.6 Write property test for filter subset (Property 4)
    - **Property 4: Filter produces a subset**
    - **Validates: Requirements 1.8**
    - File: `src/components/ui/ArchitectureGraph.test.tsx`
    - Assert filtered result is always a subset of the input; "all" returns full list before cap
    - Tag: `// Feature: legacylens-vibecon-2026, Property 4`

- [x] 3. Checkpoint — Architecture graph renders and filters correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Codebase Health Score — complete `healthScore` router and `HealthScoreWidget`
  - [x] 4.1 Export `computeWeightedScore` helper from `healthScoreCompute.ts` for property testing
    - Extract the weighted formula `Math.round(d*0.30 + c*0.25 + x*0.25 + o*0.20)` into a named export `computeWeightedScore(d, c, x, o): number`
    - Clamp result to [0, 100]
    - _Requirements: 2.2_

  - [x]* 4.2 Write property tests for health score computation (Properties 5, 6, 7)
    - **Property 5: Health score weighted formula**
    - **Property 6: Documentation coverage is a valid percentage**
    - **Property 7: Onboarding readiness increases with README presence**
    - **Validates: Requirements 2.2, 2.3, 2.6**
    - File: `src/server/services/healthScoreCompute.test.ts`
    - Property 5: use `fc.integer({ min: 0, max: 100 })` × 4; assert result equals clamped weighted sum
    - Property 6: assert `computeDocCoverage(files)` always returns value in [0, 100]
    - Property 7: assert score with README ≥ score without README + 30
    - Tag: `// Feature: legacylens-vibecon-2026, Property 5/6/7`

  - [x] 4.3 Trigger `healthScore.compute` automatically after project re-index completes
    - In `src/server/routers/project.ts`, after the indexing job marks status as `complete`, call `computeHealthScore` and upsert the result
    - _Requirements: 2.14_

  - [x]* 4.4 Write property test for health score round-trip (Property 8)
    - **Property 8: Health score round-trip**
    - **Validates: Requirements 2.12, 2.13**
    - File: `src/server/services/healthScoreCompute.test.ts`
    - Integration test: call `healthScore.compute` then `healthScore.get`; assert `overallScore` matches
    - Tag: `// Feature: legacylens-vibecon-2026, Property 8`

- [x] 5. Onboarding Guide — complete `onboarding` router and `OnboardingGuide` page
  - [x] 5.1 Verify `onboarding.generateGuide` rejects non-complete projects with correct error message
    - The router already has this guard; confirm the error message matches "Project must be fully indexed before generating an Onboarding Guide."
    - Add a unit test in `src/server/routers/onboarding.test.ts` for the rejection path
    - _Requirements: 3.12_

  - [x]* 5.2 Write property test for onboarding guide section count (Property 10)
    - **Property 10: Onboarding guide has exactly 7 sections**
    - **Validates: Requirements 3.3**
    - File: `src/server/routers/onboarding.test.ts`
    - Mock `generateOnboardingGuide` to return a realistic markdown string; assert splitting on `^## ` yields exactly 7 non-empty sections with the correct titles
    - Tag: `// Feature: legacylens-vibecon-2026, Property 10`

  - [x]* 5.3 Write property test for onboarding guide persistence round-trip (Property 9)
    - **Property 9: Onboarding guide persistence round-trip**
    - **Validates: Requirements 3.7, 3.8, 3.9, 3.10**
    - File: `src/server/routers/onboarding.test.ts`
    - Integration test: call `generateGuide` twice; assert second call returns `version = 2` and `getGuide` returns the latest
    - Tag: `// Feature: legacylens-vibecon-2026, Property 9`

  - [x] 5.4 Add "Guides" sidebar entry to `DashboardLayout.tsx`
    - The `projectNavItems` array in `src/components/layout/DashboardLayout.tsx` already includes `{ to: 'onboarding', label: 'Guides', icon: Compass }` — verify it is present and not commented out
    - _Requirements: 3.11_

- [x] 6. Commit "Why" Intelligence — complete `history` router and `History` page
  - [x] 6.1 Verify `history.generateWhy` cache-hit path skips LLM call
    - The router already checks for existing `CommitInsight`; add a unit test in `src/server/routers/history.test.ts` that inserts a `CommitInsight` directly and asserts the LLM mock is not called
    - _Requirements: 5.11_

  - [x]* 6.2 Write property test for commit insight uniqueness (Property 13)
    - **Property 13: Commit insight uniqueness and retrievability**
    - **Validates: Requirements 5.4, 5.7, 5.9, 5.10, 5.11**
    - File: `src/server/routers/history.test.ts`
    - Integration test: call `generateWhy` twice for the same `(projectId, commitHash)`; assert exactly one `CommitInsight` record exists
    - Tag: `// Feature: legacylens-vibecon-2026, Property 13`

  - [x]* 6.3 Write property test for bulk Why limit (Property 14)
    - **Property 14: Bulk Why generation respects limit**
    - **Validates: Requirements 5.8**
    - File: `src/server/routers/history.test.ts`
    - Use `fast-check` with `fc.integer({ min: 1, max: 50 })` and `fc.integer({ min: 0, max: 100 })`; assert `generated <= limit && generated <= commitCount`
    - Tag: `// Feature: legacylens-vibecon-2026, Property 14`

- [x] 7. Checkpoint — Health score, onboarding, and commit Why all pass tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. SeedService — implement `src/server/services/seed.ts`
  - [x] 8.1 Create `src/server/services/seed.ts` with the `DEMO_REPOS` constant and `run()` function
    - Define `DEMO_REPOS` with the three repos: `django/django`, `vercel/next.js`, `chatwoot/chatwoot`
    - `run()` iterates over `DEMO_REPOS`; for each, check if a `Project` with that `githubUrl` and `isDemo=true` already exists — skip if found
    - If not found: create the `Project` record with `isDemo=true`, trigger indexing via the existing `startIndexing` service, then call `computeHealthScore`, `generateOnboardingGuide`, `seedBoardCards`, `seedTeamMembers`, `seedChatMessages`, `seedMeeting`, and `cacheQAAnswers`
    - Log progress at each step using the existing `logger`
    - _Requirements: 4.1, 4.2, 4.3, 4.6, 4.8, 4.9, 4.10_

  - [x] 8.2 Implement `seedBoardCards(projectId, boardId)` in `seed.ts`
    - Create cards: ≥3 in "To Learn", ≥2 in "Exploring", ≥2 in "Understood", ≥1 in "Ready to Modify"
    - Each card must have a non-empty `linkedFiles` array referencing real file paths from the repo
    - _Requirements: 4.6, 9.1, 9.2_

  - [x] 8.3 Implement `seedTeamMembers`, `seedChatMessages`, `seedMeeting` in `seed.ts`
    - `seedTeamMembers`: create ≥2 `UserToProject` entries with synthetic names and roles
    - `seedChatMessages`: create ≥3 `Message` records in the project's team channel showing a realistic developer conversation
    - `seedMeeting`: create one `Meeting` record with `transcriptionStatus='complete'`, a non-null `transcriptText`, and `insights` containing ≥3 file path references
    - _Requirements: 6.2, 6.3, 6.4, 10.1_

  - [x] 8.4 Implement `cacheQAAnswers(projectId, redis)` in `seed.ts`
    - Pre-generate 5 Q&A answers using `generateAnswer` and store them in Redis under `demo:qa:{projectId}:{index}` keys with no TTL
    - _Requirements: 4.7, 8.2_

  - [x] 8.5 Call `SeedService.run()` from `src/server/index.ts` after the server starts
    - Import and call `run()` inside `main()` after `server.listen()`; wrap in try/catch so seed failures don't crash the server
    - _Requirements: 4.1, 4.10_

  - [x]* 8.6 Write unit tests for SeedService idempotency (Property 11)
    - **Property 11: SeedService idempotency**
    - **Validates: Requirements 4.1, 4.10**
    - File: `src/server/services/seed.test.ts`
    - Mock Prisma; call `run()` twice; assert `project.create` is called at most 3 times total across both runs
    - Tag: `// Feature: legacylens-vibecon-2026, Property 11`

  - [x]* 8.7 Write unit tests for demo repo artifact presence (Property 12)
    - **Property 12: Demo repos have required artifacts**
    - **Validates: Requirements 4.2, 4.6, 9.1**
    - File: `src/server/services/seed.test.ts`
    - After a mocked seed run, assert each demo project has a `CodebaseHealthScore`, ≥1 `OnboardingGuide`, and board cards in all four columns
    - Tag: `// Feature: legacylens-vibecon-2026, Property 12`

- [x] 9. Task Board Polish — add `board.suggestTasks` mutation
  - [x] 9.1 Add `suggestTasks` mutation to `src/server/routers/board.ts`
    - Input: `{ projectId: string }`
    - Fetch project summary (name, techStack, top 5 files by dependentsCount)
    - Call Groq LLM with a prompt asking for 5 onboarding task titles
    - Find or create the board's "To Learn" column
    - Create 5 `Card` records in that column, each with a non-empty `title` and `linkedFiles` derived from the top files
    - Return `{ tasks: string[], columnId: string }`
    - _Requirements: 9.3, 9.4_

  - [x] 9.2 Add "AI Suggest Tasks" button to `src/pages/Board.tsx`
    - Add a button in the Board page header that calls `trpc.board.suggestTasks.useMutation`
    - Show a loading spinner while pending; invalidate `board.get` on success
    - _Requirements: 9.3, 9.4_

  - [x]* 9.3 Write property test for AI Suggest Tasks card count (Property 16)
    - **Property 16: AI Suggest Tasks adds exactly 5 cards**
    - **Validates: Requirements 9.4**
    - File: `src/server/routers/board.test.ts` (create if needed)
    - Mock the LLM call to return 5 titles; assert exactly 5 `Card` records are created in the "To Learn" column, each with a non-empty `title`
    - Tag: `// Feature: legacylens-vibecon-2026, Property 16`

- [x] 10. Q&A Interface Polish — repo-specific suggestions and Redis cache
  - [x] 10.1 Enhance `qa.getSuggestions` in `src/server/routers/qa.ts` to return repo-specific questions
    - Read `project.techStack`, `project.repoDescription`, and top 5 files by `dependentsCount`
    - Build 5 questions that reference the actual tech stack and critical file names (no generic fallbacks)
    - For demo repos (`project.isDemo = true`), check Redis key `demo:qa:{projectId}:{index}` first and return pre-cached suggestions if present
    - _Requirements: 8.1, 8.4_

  - [x] 10.2 Add Redis cache check to `qa.ask` for demo repos
    - Before the RAG pipeline, check `qa:cache:{projectId}:{sha256(question)}` in Redis
    - If hit, return the cached answer directly (skip LLM + embeddings)
    - If miss, proceed normally and store the result in Redis with TTL 24h
    - _Requirements: 8.2_

  - [x]* 10.3 Write property test for Q&A suggestions count and specificity (Property 18)
    - **Property 18: Q&A suggestions are project-specific and count exactly 5**
    - **Validates: Requirements 8.1, 8.4**
    - File: `src/server/routers/qa.test.ts` (create if needed)
    - Assert `getSuggestions` always returns exactly 5 strings; assert two projects with different tech stacks return different suggestion sets
    - Tag: `// Feature: legacylens-vibecon-2026, Property 18`

- [x] 11. Checkpoint — Board and Q&A features pass tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. EmptyState component — create shared `EmptyState.tsx`
  - [x] 12.1 Create `src/components/ui/EmptyState.tsx`
    - Accept props: `icon`, `heading`, `description`, `cta?: { label, href?, onClick? }`
    - Render a centered layout with the icon (large, muted), heading, description, and optional CTA as a `<Link>` (if `href`) or `<button>` (if `onClick`)
    - _Requirements: 6.5, 6.6_

  - [x]* 12.2 Write unit tests for EmptyState component
    - File: `src/components/ui/EmptyState.test.tsx`
    - Test: renders with all props; renders without CTA; renders CTA as link when `href` provided; renders CTA as button when `onClick` provided
    - _Requirements: 6.6_

  - [x] 12.3 Replace inline empty states on History, Board, QA, and Meetings pages with `EmptyState`
    - `History.tsx`: the existing inline empty state already matches the spec — refactor it to use `<EmptyState>` with `GitCommit` icon, heading "No commit history yet", and "Go to Overview to Re-index" CTA
    - `Board.tsx`: add an `EmptyState` when `columns.length === 0` or all columns have zero cards
    - `QA.tsx`: the existing centered empty state can remain as-is (it already has icon + description + suggestions)
    - `Meetings.tsx`: add an `EmptyState` when `meetings.length === 0`
    - _Requirements: 6.1, 6.5_

- [x] 13. Dashboard — show "Featured" badge on demo repos
  - [x] 13.1 Update `src/pages/Dashboard.tsx` to display a "Featured" badge on projects where `isDemo = true`
    - Add a `Star` or `Sparkles` icon badge in the project card header when `project.isDemo === true`
    - Ensure `trpc.project.list` returns the `isDemo` field (add to the select in `src/server/routers/project.ts` if missing)
    - _Requirements: 4.4_

- [x] 14. Meeting Intelligence Polish — verify demo meeting seeding and detail page
  - [x] 14.1 Verify `MeetingDetail.tsx` renders transcript with timestamps, decisions, and action items
    - Check that the existing `MeetingDetail` page displays `insights.decisions` and `insights.actionItems` in a structured list
    - If missing, add a structured section rendering `insights.decisions` as a bulleted list and `insights.actionItems` as a checklist
    - _Requirements: 10.2, 10.3_

  - [x]* 14.2 Write property test for demo meeting completeness (Property 17)
    - **Property 17: Demo meeting has complete transcript and file links**
    - **Validates: Requirements 6.4, 10.1**
    - File: `src/server/services/seed.test.ts`
    - After mocked seed, assert the seeded `Meeting` has `transcriptionStatus='complete'`, non-null `transcriptText`, and `insights` with ≥3 file path references
    - Tag: `// Feature: legacylens-vibecon-2026, Property 17`

- [ ] 15. Demo board card property test
  - [x]* 15.1 Write property test for demo board minimum card counts (Property 15)
    - **Property 15: Demo board minimum card counts**
    - **Validates: Requirements 9.1, 9.2**
    - File: `src/server/services/seed.test.ts`
    - After mocked seed, assert "To Learn" ≥ 3 cards, "Exploring" ≥ 2, "Understood" ≥ 2, "Ready to Modify" ≥ 1; every card has non-empty `linkedFiles`
    - Tag: `// Feature: legacylens-vibecon-2026, Property 15`

- [x] 16. Final checkpoint — all features integrated and all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- The `architecture` router (task 2.1) is the only missing router — all others (`healthScore`, `onboarding`, `history`, `board`, `qa`) already exist and are registered
- The Prisma schema already has all three new models and the `isDemo` field — only a migration is needed (task 1)
- The sidebar "Guides" entry already exists in `DashboardLayout.tsx` — task 5.4 is a verification step
- `fast-check` is already a compatible library with the Vitest setup in `package.json`
- Property tests should use `{ numRuns: 100 }` configuration
