# Future Features — Make LegacyLens Super Powerful

Ideas that build on what you already have (codebase intelligence, DevOps Helper, History, Meetings) and would make the platform a must-have for teams dealing with legacy and inherited code.

---

## 1. Codebase health & tech debt dashboard

**What:** A single view per project: “How healthy is this codebase?”

- **Duplicate code detection** — Find same or near-identical snippets across files (embeddings + similarity). “3 places have the same 20-line validation block.”
- **Dead code / unused exports** — From your dependency graph: files or exports never imported. “These 12 files are not referenced anywhere.”
- **Outdated dependencies** — Parse `package.json` / `requirements.txt`; compare with latest versions; flag known vulnerabilities (e.g. npm audit, Snyk).
- **Complexity hotspots** — Per-file: size, coupling (dependents count you already have), optional cyclomatic complexity. “Top 10 riskiest files.”
- **Tech debt score** — One number or grade (e.g. A–F) from duplicates, dead code, outdated deps, and complexity.

**Why powerful:** Gives managers and leads a clear “where to invest” and makes tech debt visible instead of tribal knowledge.

---

## 2. Refactor & abstraction suggestions

**What:** AI suggests concrete refactors tied to your code.

- **Extract function/module** — User selects a block; LegacyLens suggests “Extract to `utils/parseDate.ts`” with a draft and call sites.
- **Same pattern in N places** — “This pattern appears in 5 files; here’s a suggested shared helper” (from embeddings + LLM).
- **Rename symbol** — “Rename `getUser` → `fetchUser`” and list all references (your graph already supports “who depends on this”).
- **Split file** — “This 800-line file has 3 logical modules; suggest how to split.”

**Why powerful:** Turns “we should refactor” into “here’s the first step,” especially for juniors.

---
## 4. API surface map

**What:** Explicit map of “what does this codebase expose?”

- **REST / GraphQL** — Parse routes, handlers, resolvers; list “Endpoint X → implemented in file Y.”
- **Public APIs** — From your parsed exports: “These are the public functions/modules.”
- **“Who calls this API?”** — Which other services or files call this endpoint/function (from graph + optional HTTP client usage).
- **Impact of change** — “If you change this route, these clients/code paths are affected.”

**Why powerful:** Essential for API-first or microservice codebases; makes breaking changes visible.

---

## 5. Documentation generation & sync

**What:** Keep docs aligned with code.

- **README sections** — Auto-generate: “Getting started,” “Architecture overview,” “Main entry points” from indexed data + LLM.
- **Per-file or per-module “what this does”** — One short paragraph per file (or for each major export), stored in LegacyLens or as comments.
- **Changelog / release notes** — “What changed since last tag?” using commits + your commit summaries; optional link to GitHub releases.

**Why powerful:** Docs stay up to date; new hires and on-call get one place for “what is this?”

---

## 6. Slack / Discord / Teams bot

**What:** Answer questions from chat.

- **@legacylens** — “What does the auth middleware do?” → RAG answer in channel with link to project/architecture.
- **Incident context** — “@legacylens incident for service X” → post your existing “export context” (blast radius, recent commits, runbook) into the channel.
- **Daily digest** — “New commits this week” or “Files changed in area Y” (optional).

**Why powerful:** Knowledge lives where the team already works; no context switching.

---

## 7. IDE / VS Code extension

**What:** LegacyLens inside the editor.

- **“Open in LegacyLens”** — Right-click file or symbol → open project/architecture/QA in browser.
- **In-editor blame** — Show last commit + your commit summary for the current line or file (no leaving the IDE).
- **“Explain this”** — Selection → call LegacyLens API → show explanation in a panel or hover.
- **“Find usages”** — Uses your graph to list call sites.

**Why powerful:** Reduces tab-switching; brings “why was this written?” into the flow of coding.

---

## 8. Branch / diff impact

**What:** Understand the impact of a change before merge.

- **Compare branch to main** — “Files changed in this branch” + for each file: **blast radius** (what depends on it) and “last commit.”
- **“What changed and what’s the impact?”** — One summary: “You changed 5 files; 12 files depend on them; high-impact: auth.ts.”
- **Link to GitHub PR** — Optional: “View PR” and show the same impact in LegacyLens.

**Why powerful:** Prevents “small PR that breaks production”; great for juniors and reviewers.

---

## 9. Security & compliance

**What:** Basic security and license visibility.

- **Secrets scan** — Detect API keys, passwords, tokens in code (regex + optional ML); report in a “Security” tab.
- **Vulnerable dependencies** — npm audit / similar; “3 high, 5 medium” with upgrade suggestions.
- **License compliance** — List dependencies and their licenses; flag GPL/AGPL if that’s a policy concern.

**Why powerful:** Satisfies “we need to show we care about security and licenses” without another standalone tool.

---

## 10. “Who knows this?” / code ownership

**What:** Use git history to suggest people and ownership.

- **Per-file “last touched by”** — You have last commit; extend to “top 3 contributors” for this file (from commits).
- **“Who knows this area?”** — For a folder or subsystem: list people who committed there recently.
- **Suggested reviewers** — For a PR (or list of changed files): “Suggest reviewers” based on ownership.
- **On-call hint** — “This area is mostly owned by Team X” (from paths or metadata).

**Why powerful:** Speeds up “who do I ask?” and makes ownership explicit.

---

## 11. Symbol search & “find all usages”

**What:** Search and navigate by symbol, not just by text.

- **Symbol search** — “Find function `parseConfig`” across the repo (from your parsed functions/classes).
- **“Find all usages”** — For a function or class: list call sites (from graph or from “who imports this file” + symbol resolution).
- **Cross-project search** — For orgs: “Search across all my LegacyLens projects” (unified search).

**Why powerful:** Faster than grep for “where is this used?” and scales to large repos.

---

## 12. Test coverage & test gaps

**What:** Connect code to tests.

- **“Which tests cover this file?”** — If test files are indexed, detect `describe`/`it` (or equivalent) and map “file X is tested by test file Y.”
- **Test gap report** — “These 20 files have no tests” (or no *referenced* tests).
- **Suggest test cases** — From function signature + code, LLM suggests “test: null input, test: empty array.”

**Why powerful:** Makes “we need more tests” actionable and ties tests to the architecture you already visualize.

---

## 13. Multi-repo / workspace view

**What:** Treat several repos as one product.

- **Workspace** — One “product” = multiple GitHub repos (e.g. frontend, backend, shared lib).
- **Cross-repo dependency** — “Backend repo depends on shared-types repo”; show impact across repos.
- **Unified search and Q&A** — “How does login work?” across frontend + backend in one answer.

**Why powerful:** Matches real setups (monorepos or multi-repo products) and avoids switching projects.

---

## 14. Scheduled reports & digests

**What:** Automated “state of the codebase” and “what changed.”

- **Weekly digest** — “New files, top changed files, new commits with summaries” (email or in-app).
- **“Codebase health” report** — If you add the health dashboard: weekly score + top issues.
- **Incident recap** — “Last week’s incidents and resolutions” from your incident log.

**Why powerful:** Surfaces insights without anyone remembering to open LegacyLens.

---

## 15. AI-assisted “fix it” / PR drafts

**What:** Go from “what’s wrong” to “here’s a patch.”

- **“Add error handling to all Redis calls”** — Use safe-change + blast radius; LLM suggests edits per file; optional “Create PR” (branch + commit via GitHub API).
- **“Upgrade library X and fix breaking changes”** — List usages, suggest code changes, optional PR.
- **“Apply this pattern everywhere”** — “We now use retry(timeout); find all fetch calls and suggest the change.”

**Why powerful:** Turns runbooks and “we should fix X” into concrete, scoped changes (and optionally PRs).

---

## Quick prioritization matrix

| Feature                     | Impact (value) | Fits current stack      | Effort (rough) |
|----------------------------|----------------|-------------------------|----------------|
| Codebase health dashboard  | High           | Yes (graph, index)      | Medium         |
| Refactor suggestions       | High           | Yes (RAG, LLM)          | Medium         |
| API surface map            | High           | Yes (parser, graph)     | Medium         |
| IDE extension             | High           | Yes (API exists)        | Medium         |
| Branch/diff impact         | High           | Yes (blast radius)      | Low            |
| “Who knows this?”          | Medium         | Yes (commits)           | Low            |
| Symbol search / usages     | High           | Yes (parser, graph)     | Medium         |
| Security (secrets, deps)   | High           | Yes (scan files)        | Medium         |
| Slack/Discord bot          | Medium         | Yes (API)               | Medium         |
| Multi-repo workspace       | High (for some)| Extend projects         | High           |
| Test coverage / gaps       | Medium         | Yes (index tests)       | Medium         |
| Doc generation             | Medium         | Yes (LLM)               | Low–Medium     |
| Scheduled reports          | Medium         | Yes (cron + email)      | Low            |
| AI “fix it” / PR drafts    | Very high      | Yes (LLM + GitHub API)  | High           |
