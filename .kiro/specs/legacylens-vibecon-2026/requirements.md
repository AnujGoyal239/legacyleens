# Requirements Document

## Introduction

LegacyLens VibeCon 2026 is a comprehensive upgrade to the existing AI-powered legacy code intelligence platform. The existing MVP provides GitHub repo indexing, Q&A via RAG, a flat-file Architecture page, documentation generation, meeting intelligence, a task board, team workspace, commit history, and team chat. This feature set adds six new capabilities on top of that foundation: an interactive D3.js dependency graph, a Codebase Health Score, an Onboarding Guide auto-generator, pre-loaded demo repositories, Commit "Why" Intelligence, and UI empty-state polish. It also polishes four existing features (Documentation Generator, Q&A, Task Board, Meeting Intelligence) for the VibeCon 2026 stage demo.

The north star metric is reducing "Time to First Meaningful Contribution" from 14 days to under 2 days for any developer inheriting an unfamiliar codebase.

---

## Glossary

- **System**: The LegacyLens web application (frontend + backend), unless a sub-system is named explicitly.
- **ArchitectureGraph**: The D3.js force-directed interactive dependency graph component rendered on the Architecture page.
- **HealthScoreEngine**: The server-side service that computes the four sub-scores and the overall Codebase Health Score.
- **HealthScoreWidget**: The frontend circular-progress component that displays the Codebase Health Score on the Overview page.
- **OnboardingGuideGenerator**: The tRPC endpoint and LLM service that produces the structured Onboarding Guide.
- **OnboardingGuide**: The structured, versioned document stored in the `OnboardingGuide` DB model and rendered on the Onboarding Guide page.
- **CommitInsightService**: The tRPC endpoint and LLM service that generates "Why" explanations for commits.
- **CommitInsight**: A cached AI-generated "Why" explanation stored in the `CommitInsight` DB model.
- **DemoRepo**: A pre-indexed project with `isDemo = true`, owned by a shared demo user, visible to all authenticated users.
- **SeedService**: The startup routine that creates DemoRepos if they do not already exist.
- **HealthScore**: The integer 0–100 value stored in `CodebaseHealthScore.overallScore`.
- **GraphNode**: A single file represented as a circle in the ArchitectureGraph.
- **GraphEdge**: A directed import/dependency relationship between two GraphNodes.
- **SidePanel**: The slide-in drawer that appears when a GraphNode is clicked, showing file metadata.
- **EmptyState**: A UI state shown when a page has no data to display.
- **tRPC**: The type-safe API layer used for all client–server communication.
- **Prisma**: The ORM used to access PostgreSQL.
- **BullMQ**: The Redis-backed job queue used for background processing.
- **Groq**: The LLM inference provider (Mixtral 8x7B) used for all AI generation tasks.
- **Redis**: The in-memory store used for caching and BullMQ job state.
- **pgvector**: The PostgreSQL extension used for vector similarity search.

---

## Requirements

### Requirement 1: Interactive Dependency Graph

**User Story:** As Consultant Chris, I want to see an interactive visual map of how files and modules connect, so I can instantly identify critical files, the blast radius of changes, and the overall structure without reading a single line of code.

#### Acceptance Criteria

1. WHEN the Architecture page loads for an indexed project, THE ArchitectureGraph SHALL render a full-screen D3.js force-directed graph using `forceSimulation`, `forceLink`, `forceManyBody`, and `forceCenter`.
2. THE ArchitectureGraph SHALL represent each indexed file as a GraphNode and each import/dependency relationship as a directed GraphEdge.
3. THE ArchitectureGraph SHALL colour each GraphNode according to its risk level: red for critical (10 or more dependents), amber for high (5–9 dependents), green for medium (2–4 dependents), and grey for low (0–1 dependents).
4. THE ArchitectureGraph SHALL scale each GraphNode's radius proportionally to its dependent count, with a minimum radius of 6 px and a maximum radius of 16 px.
5. WHEN a user clicks a GraphNode, THE SidePanel SHALL open and display the file path, lines of code, risk level, direct dependency count, dependent count, and an "Ask Q&A about this file" shortcut link.
6. THE ArchitectureGraph SHALL support zoom in, zoom out, pan via mouse drag, and a reset-zoom control that returns the graph to its initial transform.
7. THE ArchitectureGraph SHALL provide a search input that highlights matching GraphNodes with a white stroke when the query matches the node's file path.
8. THE ArchitectureGraph SHALL provide a filter toolbar with four options — "Show all", "Critical only", "Frontend", "Backend" — that re-renders the graph with only the matching nodes and their edges.
9. WHEN a project contains 500 or fewer indexed files, THE ArchitectureGraph SHALL complete its initial render within 2 seconds of the page load.
10. WHEN a project contains more than 300 indexed files, THE ArchitectureGraph SHALL cap the rendered node set to the top 200 files by dependent count to maintain render performance.
11. THE Architecture page SHALL provide a "List view" toggle that switches to the existing file-table component, preserving all existing list-view functionality.
12. THE System SHALL expose a tRPC endpoint `architecture.getGraph(projectId)` that transforms the existing `architectureJson` JSONB field from PostgreSQL into a `{ nodes: GraphNode[], links: GraphEdge[] }` response.
13. IF the `architectureJson` field is null or empty for a project, THEN THE ArchitectureGraph SHALL display an empty-state message instructing the user to re-index the project.

---

### Requirement 2: Codebase Health Score

**User Story:** As Engineering Manager Emma, I want a single number that tells me how understandable and safe a codebase is, so I can prioritise documentation work and set realistic onboarding expectations for new hires.

#### Acceptance Criteria

1. THE HealthScoreWidget SHALL display the HealthScore as a circular SVG progress indicator on the Overview page, positioned next to the existing file and line-count stat cards.
2. THE HealthScoreEngine SHALL compute the overall HealthScore as a weighted sum: Documentation Coverage (30%), Critical File Risk (25%), Code Complexity (25%), and Onboarding Readiness (20%), each normalised to a 0–100 integer.
3. THE HealthScoreEngine SHALL compute Documentation Coverage as the percentage of functions and classes in the AST that have associated comments or docstrings.
4. THE HealthScoreEngine SHALL compute Critical File Risk as the percentage of files with 5 or more dependents that have at least one documented function or class.
5. THE HealthScoreEngine SHALL compute Code Complexity as a score inversely proportional to the average nesting depth and branching count across all parsed files.
6. THE HealthScoreEngine SHALL compute Onboarding Readiness based on the presence of a README file, the presence of entry-point files, and a clear folder naming convention.
7. THE HealthScoreWidget SHALL display four sub-score progress bars labelled "Documentation Coverage", "Critical File Risk", "Code Complexity", and "Onboarding Readiness", each showing its individual percentage.
8. THE HealthScoreWidget SHALL display a grade label alongside the circular indicator: "Excellent" for scores 90–100, "Good" for 70–89, "Moderate" for 50–69, "Poor" for 30–49, and "Critical" for 0–29.
9. THE HealthScoreWidget SHALL colour the circular indicator and grade label green for scores 80 and above, amber for scores 50–79, and red for scores below 50.
10. WHEN a user hovers over the circular indicator, THE HealthScoreWidget SHALL display a tooltip explaining what the score measures.
11. THE HealthScoreWidget SHALL display an "Improve Score" button that navigates to the Q&A page pre-filled with the query "What are the most underdocumented files in this codebase?".
12. THE System SHALL expose a tRPC endpoint `healthScore.compute(projectId)` that runs the HealthScoreEngine and upserts the result into the `CodebaseHealthScore` table.
13. THE System SHALL expose a tRPC endpoint `healthScore.get(projectId)` that returns the cached `CodebaseHealthScore` record for a project.
14. WHEN a project re-index completes, THE System SHALL automatically trigger `healthScore.compute` to refresh the stored score.
15. IF a project has not yet been fully indexed (status is not "complete"), THEN THE HealthScoreEngine SHALL reject the compute request with a descriptive error.

---

### Requirement 3: Onboarding Guide Auto-Generator

**User Story:** As New Hire Nina, I want a personalised step-by-step guide that tells me exactly which files to read first, which flows to understand before touching anything, and which files are dangerous, so I can be productive in my first 2 days instead of my first 4 weeks.

#### Acceptance Criteria

1. THE Overview page SHALL display a "Generate Onboarding Guide" button that navigates to the Onboarding Guide page and triggers guide generation.
2. WHEN the user clicks "Generate Onboarding Guide" and no guide exists, THE OnboardingGuideGenerator SHALL call the Groq Mixtral 8x7B LLM with a structured prompt containing the top 10 files by dependent count, entry-point files, high-complexity files, README content, and tech stack metadata.
3. THE OnboardingGuideGenerator SHALL produce a guide containing exactly 7 sections: "Start Here", "Understand the Architecture", "Core Flows", "Files to Read Before Touching Anything", "Safe Zones", "Known Complexity Hotspots", and "Suggested First Tasks".
4. THE Onboarding Guide page SHALL render each section as a collapsible/expandable panel, with the first 3 sections expanded by default.
5. WHEN a file path is mentioned in the guide content, THE Onboarding Guide page SHALL render it as a clickable link that opens the Architecture SidePanel for that file.
6. THE Onboarding Guide page SHALL provide an "Export as Markdown" button that downloads the guide content as a `.md` file.
7. THE Onboarding Guide page SHALL provide a "Regenerate" button that calls `onboarding.generateGuide` again and increments the version number stored in the `OnboardingGuide` table.
8. THE System SHALL persist each generated guide in the `OnboardingGuide` table with fields: `id`, `projectId`, `content` (JSONB containing the markdown string), `version` (auto-incremented integer), and `generatedAt`.
9. THE System SHALL expose a tRPC endpoint `onboarding.generateGuide(projectId)` that orchestrates the LLM call and DB write.
10. THE System SHALL expose a tRPC endpoint `onboarding.getGuide(projectId)` that returns the most recently generated guide for a project.
11. THE sidebar navigation SHALL include a "Guides" entry that links to the Onboarding Guide page for the current project.
12. IF a project has not yet been fully indexed, THEN THE OnboardingGuideGenerator SHALL reject the request with a descriptive error message displayed to the user.
13. WHEN guide generation is in progress, THE Onboarding Guide page SHALL display a loading spinner and the message "This may take 10–20 seconds. The guide is being tailored to your specific codebase."

---

### Requirement 4: Pre-Loaded Demo Repositories

**User Story:** As a VibeCon presenter, I want three famous open-source repositories pre-indexed and ready to demo, so that the demo works instantly on stage without depending on live GitHub API calls or indexing time.

#### Acceptance Criteria

1. THE SeedService SHALL index and store three repositories on startup if they do not already exist: `django/django`, `vercel/next.js`, and `Chatwoot/chatwoot`.
2. THE SeedService SHALL set `isDemo = true` on each DemoRepo's `Project` record.
3. THE SeedService SHALL associate each DemoRepo with a shared "demo" user account that is visible to all authenticated users.
4. THE Dashboard (Projects page) SHALL display a "Featured" badge on each DemoRepo card.
5. WHEN a user opens a DemoRepo, THE System SHALL serve the pre-computed HealthScore, ArchitectureGraph, and OnboardingGuide from the database without triggering new computation.
6. THE SeedService SHALL pre-generate a HealthScore, an ArchitectureGraph, and an OnboardingGuide for each DemoRepo during the seed process.
7. THE SeedService SHALL pre-cache answers to the top 5 Q&A questions per DemoRepo in Redis so that the first answer for each question is served within 1 second.
8. THE System SHALL define a `DEMO_REPOS` constant in the backend containing the GitHub URLs and display names for the three repositories.
9. WHILE a DemoRepo is being seeded, THE SeedService SHALL log progress at each major step (clone, index, health score, guide, Q&A cache).
10. IF a DemoRepo already exists in the database on startup, THEN THE SeedService SHALL skip re-indexing that repository.

---

### Requirement 5: Commit "Why" Intelligence

**User Story:** As Consultant Chris, I want to understand WHY each significant change was made — not just WHAT changed — so I can understand the context and decisions behind the code I am inheriting.

#### Acceptance Criteria

1. THE History page SHALL display each commit entry with: short commit hash, author name, commit date, commit message, and a list of files changed.
2. WHEN a CommitInsight exists for a commit, THE History page SHALL display the "Why" explanation in an amber-highlighted panel below the commit message.
3. WHEN no CommitInsight exists for a commit, THE History page SHALL display a "Generate Why" button below the commit message.
4. WHEN the user clicks "Generate Why" for a commit, THE CommitInsightService SHALL call the Groq LLM with the commit message, list of files changed, and a diff summary of up to 500 tokens, and store the result in the `CommitInsight` table.
5. THE CommitInsightService SHALL generate a "Why" explanation of 2–3 sentences describing the likely business or technical reason for the change.
6. THE History page SHALL display a "Generate Why for all commits" bulk action button at the top of the page that calls `history.generateAllWhy` for up to 20 commits without an existing CommitInsight.
7. THE System SHALL expose a tRPC endpoint `history.generateWhy(projectId, commitHash)` that checks the cache, calls the LLM if no cache exists, and returns the CommitInsight.
8. THE System SHALL expose a tRPC endpoint `history.generateAllWhy(projectId, limit)` that iterates over commits without a CommitInsight and generates explanations sequentially.
9. THE System SHALL expose a tRPC endpoint `history.getInsights(projectId)` that returns a map of `commitHash → why` for all cached CommitInsights in a project.
10. THE CommitInsightService SHALL store each generated explanation in the `CommitInsight` table with a unique constraint on `(projectId, commitHash)` to prevent duplicate generation.
11. WHEN a CommitInsight already exists for a given `(projectId, commitHash)` pair, THE CommitInsightService SHALL return the cached value without calling the LLM.
12. WHEN the History page has no commits, THE History page SHALL display an EmptyState with a "Go to Overview to Re-index" button and a one-line explanation, rather than a plain "No commits found" message.

---

### Requirement 6: UI Empty State Polish

**User Story:** As a VibeCon presenter, I want all pages to show helpful, actionable empty states instead of bare "No X found" messages, so that the product appears polished and complete to judges even when viewing a fresh or demo repository.

#### Acceptance Criteria

1. WHEN the History page has no commits, THE History page SHALL display an EmptyState containing a GitCommit icon, the heading "No commit history yet", a one-line explanation, and a "Go to Overview to Re-index" CTA button.
2. WHEN the Team page is viewed for a DemoRepo, THE Team page SHALL display at least 2 synthetic team members with realistic names, roles, and "last active" timestamps pre-populated in the database.
3. WHEN the Chat page is viewed for a DemoRepo, THE Chat page SHALL display at least 3 pre-seeded messages showing a realistic developer conversation.
4. WHEN the Meetings page is viewed for a DemoRepo, THE Meetings page SHALL display at least one pre-uploaded meeting with a processed transcript and at least 3 extracted code file links.
5. WHEN any non-demo project page has no data to display, THE System SHALL render an EmptyState component containing a relevant icon, a one-line explanation, and a CTA button — not a plain text "No X yet" string.
6. THE EmptyState component SHALL accept props for: icon, heading, description, and an optional CTA button label and href.

---

### Requirement 7: Documentation Generator Polish

**User Story:** As a VibeCon presenter, I want the Documentation Generator to produce syntax-highlighted, exportable output with a streaming skeleton UI, so that the feature is visually impressive on a projector.

#### Acceptance Criteria

1. WHEN the Documentation Generator produces output, THE Documentation page SHALL render code blocks within the generated document with syntax highlighting using `react-syntax-highlighter`.
2. THE Documentation page SHALL display a "Copy to Clipboard" button next to each generated document section that copies the section content to the clipboard.
3. THE Documentation page SHALL display an "Export as Markdown" button that downloads the full generated document as a `.md` file.
4. WHEN documentation generation takes longer than 10 seconds, THE Documentation page SHALL display a streaming skeleton UI — animated placeholder lines that are progressively replaced by real content as it streams in.
5. WHEN the "Generate HLD" action is triggered on a DemoRepo, THE System SHALL complete generation and begin streaming the response within 15 seconds.

---

### Requirement 8: Q&A Interface Polish

**User Story:** As a VibeCon presenter, I want the Q&A interface to show repo-specific question chips, syntax-highlighted answers with file links, and sub-1-second responses for demo repos, so that the feature is compelling on stage.

#### Acceptance Criteria

1. THE Q&A page SHALL display 5 suggested question chips that are specific to the current repository, not generic placeholder questions.
2. WHEN a DemoRepo is active, THE Q&A page SHALL serve the pre-cached answer for each of the 5 suggested questions within 1 second by reading from Redis.
3. WHEN the Q&A answer contains a code snippet, THE Q&A page SHALL render it with syntax highlighting and display the source file path and line number as a clickable link to the Architecture page.
4. THE System SHALL store the 5 repo-specific suggested questions per project in the database or derive them from the project's tech stack and top files at query time.

---

### Requirement 9: Task Board Polish

**User Story:** As a VibeCon presenter, I want the Task Board to be pre-populated for demo repos and to offer an AI "Suggest Tasks" button, so that the board looks active and useful on stage.

#### Acceptance Criteria

1. WHEN the Task Board is viewed for a DemoRepo, THE Task Board SHALL display a pre-populated board with at least 3 cards in "To Learn", 2 in "Exploring", 2 in "Understood", and 1 in "Ready to Modify".
2. WHEN the Task Board is viewed for a DemoRepo, each pre-populated card SHALL include a linked file path and a short description.
3. THE Task Board page SHALL display an "AI Suggest Tasks" button that calls the LLM with the project's codebase summary and returns 5 suggested onboarding task titles to add to the board.
4. WHEN the "AI Suggest Tasks" button is clicked, THE System SHALL add the 5 suggested tasks as new cards in the "To Learn" column.

---

### Requirement 10: Meeting Intelligence Polish

**User Story:** As a VibeCon presenter, I want a pre-recorded meeting with a processed transcript and code links visible for demo repos, so that the Meeting Intelligence feature is immediately demonstrable on stage.

#### Acceptance Criteria

1. WHEN the Meetings page is viewed for a DemoRepo, THE Meetings page SHALL display at least one pre-uploaded meeting with a complete transcript, extracted timestamps, extracted decisions, and at least 3 linked file paths.
2. THE Meeting detail page SHALL display the transcript with timestamps visible for each segment.
3. THE Meeting detail page SHALL display extracted decisions and action items in a structured list.
