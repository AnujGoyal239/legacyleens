# LegacyLens — Complete Feature Scope Document
**Version:** 1.0  
**Last Updated:** February 18, 2026  
**Document Purpose:** Comprehensive catalog of all features, categorized by scope type (Technical Infrastructure, Core Features, New Feature Add-ons, Future Roadmap)

---

## 📋 Executive Summary

**LegacyLens** is an AI-powered legacy code intelligence platform designed to dramatically reduce developer onboarding time from weeks to hours. This document provides a complete inventory of:

1. **Core Features** — Implemented and production-ready
2. **Technical Infrastructure Features** — Technical improvements, optimizations, and architectural enhancements
3. **New Feature Add-ons** — Planned features built on existing architecture
4. **Future Ideas** — Long-term roadmap features

**Total Features Cataloged:** 50+

---

## 🎯 Core Features (MVP & Beyond) — IMPLEMENTED ✅

### **1. Instant Codebase Intelligence** 
**Status:** ✅ IMPLEMENTED  
**Scope:** Core Feature  
**Type:** Primary Feature

Allows users to upload a GitHub repository and get instant analysis of the codebase structure.

**Components:**
- Repository connection via GitHub OAuth
- Automatic code indexing (<5 minutes for 10K+ files)
- **Architecture JSON generation** — Dependency graph stored in `Project.architectureJson`
- **Tech stack detection** — Languages, frameworks, libraries stored in `Project.techStack`
- **Entry point detection** — Main files identified and stored in `Project.entryPoints`
- **File indexing** — Complete parsing of all files with metadata
- Multi-language support: Python, JavaScript/TypeScript, Java, Go, Ruby, PHP, C#

**Related Tables:**
- `Project` (status, totalFiles, processedFiles, architectureJson)
- `File` (filePath, fileType, functions, classes, imports, exports)

**Related Services:**
- `parser.ts` — AST parsing via Tree-sitter
- `github.ts` — GitHub API integration
- Background worker: `indexing.worker.ts`

---

### **2. AI-Powered Q&A (RAG Pipeline)**
**Status:** ✅ IMPLEMENTED  
**Scope:** Core Feature  
**Type:** Primary Feature

Natural language interface for asking questions about the codebase with AI-generated answers.

**Components:**
- Semantic code search using vector embeddings
- RAG (Retrieval-Augmented Generation) pipeline
- Streaming LLM responses
- Context awareness — traces back to specific files + line numbers
- Caching mechanism (1hr TTL) for common questions
- Response time tracking (<3 seconds target)

**Related Tables:**
- `QAConversation` (question, answer, contextFiles, responseTimeMs)
- `Embedding` (code snippets + meeting chunks)

**Related Services:**
- `search.ts` — Vector similarity search
- `embeddings.ts` — Cohere Embed v3 integration
- `llm.ts` — Groq LLM streaming
- `analyzer.ts` — Code context extraction

**Example Questions Answered:**
- "Why is authentication handled in middleware?"
- "Where are database queries made?"
- "What does the deployment process look like?"
- "Find all places where Redis is used"

---

### **3. Visual Architecture Mapping**
**Status:** ✅ IMPLEMENTED  
**Scope:** Core Feature  
**Type:** Primary Feature

Interactive dependency graph visualization showing code relationships and risk levels.

**Components:**
- D3.js-based interactive architecture graph
- **Risk level indicators** (low, medium, high, critical)
- Dependency visualization (imports, exports, function calls)
- **Blast radius calculation** — Shows which files depend on selected file
- Component zoom and pan
- Hover tooltips showing file metadata

**Related Tables:**
- `File` (riskLevel, dependentsCount, dependenciesCount, isEntryPoint)
- `Project` (architectureJson)

**Related Services:**
- `analyzer.ts` — Dependency graph generation
- Frontend component: `ArchitectureGraph.tsx`

**Visual Features:**
- Node colors indicate risk level
- Edge thickness shows dependency strength
- Filtering by file type or dependency level
- Export graph as JSON or image

---

### **4. Task Board (Trello-Style Onboarding)**
**Status:** ✅ IMPLEMENTED  
**Scope:** Core Feature  
**Type:** Secondary Feature

Kanban-style task management for tracking onboarding progress.

**Components:**
- Multiple columns (e.g., To Do, In Progress, Done)
- Draggable cards with descriptions
- Card-to-code linking (associated files)
- Card-to-Q&A linking (reference previous questions)
- Time tracking per card
- User assignment functionality
- Card reordering and prioritization

**Related Tables:**
- `Board` (projectId, name)
- `Column` (boardId, name, position)
- `Card` (columnId, title, description, linkedFiles, linkedQaIds, assignedToId, timeSpentMinutes)

**Related Services:**
- Frontend component: `KanbanBoard.tsx`
- `board.ts` router

**Use Cases:**
- Track "understand X" tasks
- Link documentation reading to specific files
- Coordinate team onboarding
- Measure onboarding progress

---

### **5. Meeting Intelligence (Transcription + Linking)**
**Status:** ✅ IMPLEMENTED  
**Scope:** Core Feature  
**Type:** Secondary Feature

Upload meeting recordings, auto-transcribe, and link insights to code.

**Components:**
- Audio/video file upload (Backblaze B2 storage)
- **Automatic transcription** via Groq Whisper AI
- **AI-extracted insights** (decisions, action items, risks, technical discussions)
- Meeting transcript search (Q&A against meeting content)
- **Live meeting recording** capability
- Meeting summary generation
- Timestamp-based linking to code

**Related Tables:**
- `Meeting` (title, fileUrl, transcriptionStatus, transcriptText, summary, insights)
- `Embedding` (meetingId, timestampStart, timestampEnd for meeting chunks)

**Related Services:**
- `github.ts` — File upload/storage
- `llm.ts` — Insight extraction
- Background worker: `transcription.worker.ts`
- Frontend component: `MeetingDetail.tsx`

**Insight Types Extracted:**
- Key decisions made
- Action items assigned
- Technical discussions recorded
- Risk discussions identified
- Architecture changes discussed

---

### **6. User Authentication & Authorization**
**Status:** ✅ IMPLEMENTED  
**Scope:** Technical Infrastructure  
**Type:** Core Infrastructure

Secure user authentication and access control.

**Components:**
- **Clerk Auth** integration (OAuth sign-up/login)
- JWT token-based session management
- Role-based access control (owner, admin, member, viewer)
- GitHub OAuth integration for repo access
- Encrypted GitHub token storage

**Related Tables:**
- `User` (email, name, clerkId, githubId, githubToken, subscriptionTier, credits)
- `UserToProject` (userId, projectId, role)

**Related Services:**
- `auth.ts` router
- Backend middleware: auth JWT verification

**Security Features:**
- Token encryption at rest
- HTTPS-only communication
- Rate limiting on API endpoints
- Secure session management

---

### **7. Billing & Credit System**
**Status:** ✅ IMPLEMENTED  
**Scope:** Core Feature  
**Type:** Monetization

Tiered pricing model with credit-based usage tracking.

**Components:**
- Subscription tier management (free, pro, team, enterprise)
- **Credit system** for resource usage
- **Stripe integration** for payment processing
- Usage logging per action (index, qa, meeting, export)
- Credit deduction per operation
- Subscription cancellation and renewal management

**Related Tables:**
- `User` (credits, subscriptionTier)
- `Subscription` (userId, stripeCustomerId, tier, status, currentPeriodEnd)
- `UsageLog` (userId, projectId, action, costCredits, metadata)

**Related Services:**
- `billing.ts` router
- Stripe webhook handlers

**Pricing Tiers:**
- **Free:** 1 project, 1000 initial credits, limited queries
- **Pro:** $29/mo, 10 projects, unlimited queries, priority support
- **Team:** $99/mo, unlimited projects, collaboration features
- **Enterprise:** Custom pricing, self-hosted option, SSO, SLA

**Credit Usage:**
- Repository indexing: ~100 credits per project
- Q&A queries: ~5 credits per query
- Meeting transcription: ~50 credits per hour

---

### **8. Project Management**
**Status:** ✅ IMPLEMENTED  
**Scope:** Core Feature  
**Type:** Core Infrastructure

Create, manage, and organize multiple GitHub repositories.

**Components:**
- Project creation with GitHub URL
- Repository metadata storage (stars, forks, language, description)
- Project member management
- Role-based access (owner, admin, member, viewer)
- Project settings and configuration
- Indexing status tracking and progress display
- Error handling and retry mechanisms

**Related Tables:**
- `Project` (githubUrl, status, totalFiles, processedFiles, repoOwner, repoName, etc.)
- `UserToProject` (userId, projectId, role)

**Related Services:**
- `project.ts` router
- `github.ts` — Repository metadata fetching

---

### **9. Code Analysis & Dependency Graph**
**Status:** ✅ IMPLEMENTED  
**Scope:** Technical Infrastructure  
**Type:** Analysis Engine

Deep code analysis generating dependency graphs and risk assessments.

**Components:**
- **Abstract Syntax Tree (AST) parsing** via Tree-sitter
- Function/class extraction with signatures
- Import/export analysis
- **Dependency graph generation** showing code relationships
- **Risk level assessment** per file (low, medium, high, critical)
- Cyclic dependency detection
- Entry point identification
- **Dependents counting** (how many files import this file)

**Related Tables:**
- `File` (functions, classes, imports, exports, riskLevel, dependentsCount, dependenciesCount, isEntryPoint)
- `Project` (architectureJson)

**Related Services:**
- `parser.ts` — Tree-sitter AST parsing
- `analyzer.ts` — Dependency graph and risk calculation

**Risk Factors:**
- High dependency count (changes affect many files)
- Cyclic dependencies
- Missing tests
- Large file size
- Low code reusability

---

### **10. Vector Embeddings & Semantic Search**
**Status:** ✅ IMPLEMENTED  
**Scope:** Technical Infrastructure  
**Type:** AI/ML Foundation

High-dimensional vector embeddings for semantic code understanding.

**Components:**
- **Cohere Embed v3** integration (1024-dimension embeddings)
- pgvector storage in PostgreSQL
- Cosine similarity search
- Batch embedding processing
- Meeting transcript embeddings with timestamps
- Embedding caching and reuse

**Related Tables:**
- `Embedding` (projectId, type, filePath, content, embedding, meetingId, timestampStart, timestampEnd)

**Related Services:**
- `embeddings.ts` — Cohere API integration
- Background worker: embedding generation

**Embedding Types:**
- Full file embeddings
- Function-level embeddings
- Class-level embeddings
- Meeting chunk embeddings (with time references)

---

### **11. GitHub Integration**
**Status:** ✅ IMPLEMENTED  
**Scope:** Technical Infrastructure  
**Type:** External Integration

Seamless integration with GitHub for repository access and metadata.

**Components:**
- OAuth-based authentication
- Repository cloning and analysis
- GitHub commit history tracking
- Pull request integration
- **Recent commits retrieval** (for "what changed?" queries)
- Repository metadata fetching (stars, forks, language, topics)
- **Personal Access Token (PAT)** support for private repos

**Related Tables:**
- `Project` (githubUrl, githubRepoId, githubPat)
- `Commit` (commitHash, message, author, filesChanged)
- `User` (githubId, githubToken, githubUsername)
- `PullRequest` (githubPrId, title, state, filesChanged, reviewers)

**Related Services:**
- `github.ts` — GitHub API methods
- `githubPr.ts` — Pull request analysis

**GitHub Data Captured:**
- Recent commits with authors and messages
- File changes per commit
- Pull requests with affected files
- Repository metadata (stars, forks, description)
- Branch information

---

### **12. Background Job Processing**
**Status:** ✅ IMPLEMENTED  
**Scope:** Technical Infrastructure  
**Type:** Job Queue System

Asynchronous task processing for heavy operations using BullMQ.

**Components:**
- **BullMQ job queue** with Redis backing
- Job retry logic and error handling
- Progress tracking and status updates
- Multiple job types:
  - `index:repo` — Repository indexing
  - `meeting:process` — Meeting transcription
  - `embed:batch` — Batch embedding generation
  - `scan:risks` — Risk scanning (optional)

**Related Services:**
- `src/server/queues/index.ts` — Queue setup
- Background worker: `src/workers/index.ts`
- Dedicated workers for each job type

**Job Features:**
- Persistent job state in Redis
- Automatic retries on failure
- Progress events for UI updates
- Job completion callbacks
- Graceful shutdown handling

---

### **13. Documentation Generation**
**Status:** ✅ IMPLEMENTED  
**Scope:** New Feature Add-on  
**Type:** Documentation

Auto-generate documentation from code analysis.

**Components:**
- README section generation (Getting Started, Architecture, Entry Points)
- Per-file/module description generation
- Technology stack documentation
- Changelog generation from commits
- Documentation sync with code changes

**Related Services:**
- `documentationGenerator.ts` — Doc generation logic
- Uses LLM for content creation

**Generated Sections:**
- Overview
- Architecture explanation
- Getting started guide
- Technology stack
- Key files explanation
- Setup instructions

---

### **14. Security Analysis**
**Status:** ✅ IMPLEMENTED  
**Scope:** New Feature Add-on  
**Type:** Security

Identify and report security issues in code.

**Components:**
- **Secrets detection** (API keys, passwords, tokens)
- Vulnerable dependency identification
- License compliance checking
- Security pattern analysis
- Risk reporting and remediation suggestions

**Related Services:**
- `security.ts` — Security scanning logic

**Security Checks:**
- Secrets in code (regex + optional ML)
- Known vulnerable dependencies
- GPL/AGPL/AGSL license flags
- Insecure patterns (empty catch blocks, unhandled promises)
- Missing input validation patterns

---

### **15. Test Coverage Analysis**
**Status:** ✅ IMPLEMENTED  
**Scope:** New Feature Add-on  
**Type:** Quality Assurance

Analyze test coverage and identify gaps.

**Components:**
- Test file detection and parsing
- Coverage mapping (which files are tested)
- Test gap identification
- **AI-suggested test cases** per function
- Coverage reports and metrics

**Related Services:**
- `testCoverage.ts` — Coverage analysis

**Coverage Features:**
- File-to-test mapping
- Untested file identification
- Test case suggestions
- Coverage trend tracking

---

### **16. Refactor & Abstraction Suggestions**
**Status:** ✅ IMPLEMENTED  
**Scope:** New Feature Add-on  
**Type:** Code Quality

AI-powered suggestions for code refactoring and improvements.

**Components:**
- Pattern repetition detection (embeddings + similarity)
- Extract function/module suggestions
- Rename symbol recommendations
- File splitting suggestions
- DRY principle violations detection
- Coupling and complexity analysis

**Related Services:**
- `refactorSuggestions.ts` — Refactoring engine
- Uses embeddings for pattern matching
- LLM for suggestion generation

**Refactoring Suggestions:**
- Extract repeated code into utilities
- Split large files into modules
- Better naming conventions
- Reduce cyclomatic complexity
- Remove code duplication

---

### **17. Health Dashboard & Tech Debt**
**Status:** ✅ IMPLEMENTED  
**Scope:** New Feature Add-on  
**Type:** Codebase Health

Unified view of codebase health and technical debt.

**Components:**
- **Duplicate code detection**
- Dead code/unused exports identification
- Outdated dependency flagging
- Complexity hotspots analysis
- **Tech debt scoring** (A-F grade)
- Risk prioritization

**Related Services:**
- `healthDashboard.ts` — Health metrics calculation

**Health Metrics:**
- Overall tech debt score
- Top 10 riskiest files
- Duplicate code percentage
- Dead code percentage
- Outdated dependencies count
- Average file complexity

**Dashboard Visualization:**
- Trend over time
- By file type
- By severity
- Actionable recommendations

---

### **18. Incident Management & Post-Incident Learning**
**Status:** ✅ IMPLEMENTED  
**Scope:** New Feature Add-on  
**Type:** DevOps/Reliability

Track incidents, root causes, and resolutions for learning.

**Components:**
- **Incident logging** (summary, root cause, files changed, resolution)
- Incident history per project
- **Context-aware incident retrieval** (for similar future incidents)
- Post-incident learning database
- Stack trace parsing and code mapping
- Call path reconstruction from stack traces

**Related Tables:**
- `Incident` (projectId, summary, rootCause, filesChanged, resolution)

**Related Services:**
- `incident.ts` — Incident management logic
- `incident.test.ts` — Incident service tests

**Incident Features:**
- Record what broke
- Document root cause
- Track files involved
- Note resolution steps
- Reference similar incidents
- Extract patterns

---

### **19. Runbook & Hotfix Automation**
**Status:** ✅ IMPLEMENTED  
**Scope:** New Feature Add-on  
**Type:** DevOps/Reliability

Automated detection and suggestion of rollback and hotfix procedures.

**Components:**
- **Runbook auto-detection** from repo structure
- Rollback steps extraction (from CI configs, scripts)
- Hotfix procedure generation
- Environment variable mapping
- Deploy order suggestions (for microservices)
- Runbook editing and customization

**Related Tables:**
- `ProjectRunbook` (projectId, rollbackSteps, hotfixSteps, envVars)

**Related Services:**
- `runbook.ts` — Runbook generation and management
- `runbook.test.ts` — Runbook service tests

**Runbook Detection:**
- Scans `docker-compose`, `Dockerfile`, `k8s/`, scripts
- Extracts CI/CD pipeline steps
- Identifies rollback mechanisms
- Maps environment variables

---

### **20. LLM Integration**
**Status:** ✅ IMPLEMENTED  
**Scope:** Technical Infrastructure  
**Type:** AI/ML Foundation

Integration with Groq API for LLM-powered features.

**Components:**
- **Groq Mixtral 8x7B** LLM integration
- Streaming response support
- Token usage tracking
- Cost optimization (1000 tokens/request)
- Context window management
- System prompt management

**Related Services:**
- `llm.ts` — Groq API wrapper

**LLM Usage:**
- Q&A answer generation
- Code explanation
- Insight extraction from meetings
- Documentation generation
- Refactoring suggestions
- Commit message summarization

---

### **21. Pull Request Analysis**
**Status:** ✅ IMPLEMENTED  
**Scope:** New Feature Add-on  
**Type:** Code Review

Analyze pull requests for impact and risk.

**Components:**
- PR metadata fetching from GitHub
- Files changed per PR
- **Impact assessment** (blast radius of changes)
- Reviewer suggestions (based on code ownership)
- Risk analysis per PR
- Review linking to code sections

**Related Tables:**
- `PullRequest` (projectId, githubPrId, title, filesChanged, reviewers, state)
- `CardPullRequest` (linking cards to PRs)

**Related Services:**
- `pullRequest.ts` router
- `githubPr.ts` — PR analysis service

**PR Features:**
- Change impact visualization
- File-by-file analysis
- Suggested reviewers
- Risk percentage calculation
- Integration with task board

---

### **22. Commit History & Analysis**
**Status:** ✅ IMPLEMENTED  
**Scope:** Technical Infrastructure  
**Type:** History

Track and analyze repository commit history.

**Components:**
- Commit fetching from GitHub
- **Commit message summarization** via LLM
- File change tracking per commit
- Author attribution
- Commit date indexing for timelines
- Recent changes filtering

**Related Tables:**
- `Commit` (projectId, commitHash, message, author, authorEmail, filesChanged, summary, committedAt)

**Related Services:**
- Indexed during project setup
- `github.ts` — Commit retrieval

**Commit Features:**
- Last N commits retrieval
- Author statistics
- File change frequency
- Commit trend analysis

---

### **23. Team Collaboration Features**
**Status:** ✅ IMPLEMENTED  
**Scope:** New Feature Add-on  
**Type:** Collaboration

Multi-user collaboration and team workspaces.

**Components:**
- **Multiple user roles** (owner, admin, member, viewer)
- Shared project workspaces
- Role-based feature access
- **Team chat channels** (project-wide and DMs)
- Real-time collaboration indicators
- Activity tracking and notifications

**Related Tables:**
- `UserToProject` (role-based access)
- `ChatChannel` (team channels and DMs)
- `ChatMember` (channel membership)
- `Message` (chat messages with timestamps)

**Related Services:**
- `team.ts` router
- Real-time messaging via WebSocket

**Team Features:**
- Permission management
- Chat discussions linked to code
- File assignment tracking
- Shared task board
- Team analytics

---

### **24. Benchmarking & Model Evaluation**
**Status:** ✅ IMPLEMENTED  
**Scope:** New Feature Add-on  
**Type:** Testing/Quality

Benchmark LLM responses against ground-truth answers.

**Components:**
- **Benchmark suite creation** with test cases
- Test case definition (prompts, expected keywords, expected files)
- Deterministic scoring (keyword matching, file path matching)
- **Model comparison** (different LLM models)
- Result aggregation and analytics
- Performance trend tracking
- AI-powered test evaluation (optional)

**Related Tables:**
- `BenchmarkSuite` (projectId, name, description)
- `BenchmarkCase` (suiteId, name, prompt, expectedKeywords, expectedFilePaths)
- `BenchmarkRun` (suiteId, userId, modelName, status, passedCases, averageScore)
- `BenchmarkResult` (runId, caseId, score, passed, answerText, matchedKeywords, matchedFilePaths)

**Related Services:**
- `benchmarks.ts` — Benchmark execution and evaluation

**Benchmark Features:**
- Create custom test suites
- Run against different models
- Track improvement over time
- Compare LLM performance
- Export results

---

### **25. "Fix It" / PR Draft Generation**
**Status:** ✅ IMPLEMENTED  
**Scope:** New Feature Add-on  
**Type:** Code Automation

AI-assisted code fixes with optional PR generation.

**Components:**
- Issue description to code fix generation
- Safe-change identification (blast radius awareness)
- Pattern matching for "fix everywhere"
- Automated PR creation (optional)
- File-by-file fix suggestions
- Review-ready PR drafts

**Related Services:**
- `fixIt.ts` — Fix generation pipeline

**Fix It Features:**
- "Add error handling to all Redis calls"
- "Upgrade library X and fix breaking changes"
- "Apply this pattern everywhere"
- Optional direct PR creation on GitHub

---

## 🏗️ Technical Infrastructure Features (Non-Customer Facing) — IMPLEMENTED ✅

These are technical improvements and foundational features that enable the core platform.

### **26. Type Safety & Validation**
**Status:** ✅ IMPLEMENTED  
**Scope:** Technical Infrastructure  
**Type:** Code Quality

Comprehensive TypeScript and schema validation.

**Components:**
- Full TypeScript codebase (no `any` types)
- Runtime validation via Zod schemas
- Type-safe database access via Prisma
- Type-safe API via tRPC
- Shared types between frontend/backend

**Implementation:**
- `tsconfig.json` with strict mode
- Zod schemas for all API inputs
- Prisma type generation
- tRPC context types

---

### **27. Database Architecture (PostgreSQL + pgvector)**
**Status:** ✅ IMPLEMENTED  
**Scope:** Technical Infrastructure  
**Type:** Data Storage

Robust relational database with vector support.

**Components:**
- PostgreSQL via Supabase
- **pgvector extension** for vector embeddings (1024-dim)
- Prisma ORM for type-safe queries
- Database migrations (Prisma Migrate)
- Backup and recovery procedures
- Connection pooling

**Database Features:**
- 25+ tables for comprehensive data model
- Vector similarity search support
- Full-text search capability
- Transaction support
- Automatic timestamps and soft deletes

---

### **28. Caching Strategy**
**Status:** ✅ IMPLEMENTED  
**Scope:** Technical Infrastructure  
**Type:** Performance

Multi-layer caching for performance optimization.

**Components:**
- **Redis caching** for:
  - Q&A query results (1hr TTL)
  - Search results
  - Session management
  - BullMQ job state
- Query result caching
- Embedding cache (prevent re-computation)
- Rate limit tracking

**Caching Benefits:**
- 10x faster Q&A responses for common questions
- Reduced API calls to external services
- Lower latency
- Cost savings

---

### **29. Error Handling & Monitoring**
**Status:** ✅ IMPLEMENTED  
**Scope:** Technical Infrastructure  
**Type:** Reliability

Comprehensive error tracking and monitoring.

**Components:**
- **Sentry integration** for error tracking
- **Betterstack** for uptime monitoring
- Structured logging via Pino
- Error recovery mechanisms
- Graceful degradation (cached results if AI APIs down)

**Monitoring:**
- Error rate tracking
- API latency tracking
- Background job failure rate
- Service health metrics
- Alert notifications

---

### **30. Rate Limiting & API Protection**
**Status:** ✅ IMPLEMENTED  
**Scope:** Technical Infrastructure  
**Type:** Security/Reliability

Protect API from abuse and manage resource usage.

**Components:**
- Per-user rate limiting
- Per-endpoint rate limiting
- Credit-based rate limiting
- IP-based blocking (optional)
- Request validation via Zod

**Rate Limits:**
- Q&A: 10 queries/minute per user
- Indexing: 1 project/hour per user
- File upload: 2GB/month per user

---

### **31. Cost Optimization**
**Status:** ✅ IMPLEMENTED  
**Scope:** Technical Infrastructure  
**Type:** Financial

Minimize operational costs while maintaining quality.

**Components:**
- Groq API (10x cheaper than OpenAI)
- Cohere embeddings (cheapest available)
- Backblaze B2 storage (10x cheaper than S3)
- Supabase free tier (generous limits)
- Redis only for metadata, not data storage
- Query result caching

**Cost Targets:**
- <$0.10 per project indexed
- <$0.01 per Q&A query
- <$0.05 per meeting transcription

---

### **32. Logging & Observability**
**Status:** ✅ IMPLEMENTED  
**Scope:** Technical Infrastructure  
**Type:** Operations

Comprehensive logging for debugging and operations.

**Components:**
- Pino logger with JSON output
- Structured logging (userId, projectId, action)
- Log levels (debug, info, warn, error)
- Log aggregation (Betterstack)
- Request tracing (trace ID in logs)

**Logging:**
- API request/response
- Background job execution
- External API calls
- Error details
- Performance metrics

---

### **33. Docker & Containerization**
**Status:** ✅ IMPLEMENTED  
**Scope:** Technical Infrastructure  
**Type:** DevOps

Container-based deployment.

**Components:**
- Multi-stage Docker builds
- Docker Compose for local development
- Separate images for server and workers
- Environment-specific configurations
- Health checks

**Docker Setup:**
- Frontend container (Vite SPA)
- API server container (Fastify)
- Worker container (BullMQ)
- PostgreSQL + Redis (Docker Compose)

---

### **34. Environment Management**
**Status:** ✅ IMPLEMENTED  
**Scope:** Technical Infrastructure  
**Type:** Configuration

Flexible environment configuration for different stages.

**Components:**
- `.env` files for local development
- Environment variables for production
- Secret management (encrypted tokens)
- API key rotation support
- Multi-environment config

**Managed Secrets:**
- GitHub tokens
- Groq API keys
- Cohere API keys
- Stripe keys
- Database connection strings

---

### **35. Build & Deployment Pipeline**
**Status:** ✅ IMPLEMENTED  
**Scope:** Technical Infrastructure  
**Type:** DevOps

Automated build and deployment process.

**Components:**
- Vite build for frontend (optimized bundles)
- TypeScript compilation for backend
- Docker image building
- Deployment to Fly.io
- Automated migrations
- Zero-downtime deployments

**Build Process:**
- Type checking
- Linting
- Testing
- Asset optimization
- Source map generation

---

## 🚀 New Feature Add-ons (Planned/In Progress) — PARTIALLY IMPLEMENTED ⚠️

These features build on the core platform and are either in development or planned for upcoming releases.

### **36. Codebase Health Dashboard (Expanded)**
**Status:** ⚠️ PARTIALLY IMPLEMENTED  
**Scope:** New Feature  
**Type:** Analytics/Metrics

Comprehensive view of codebase health and tech debt.

**Planned Enhancements:**
- Real-time health scoring (A-F grade)
- Duplicate code percentage tracking
- Dead code identification over time
- Outdated dependency matrix
- Complexity trend analysis
- Health score comparison with industry benchmarks

**Current Implementation:**
- `healthDashboard.ts` service exists
- Basic risk calculations implemented
- Visualizations in Insights page

**Missing Elements:**
- Industry benchmark comparison
- Automated remediation suggestions
- Historical trend tracking

---

### **37. Onboarding Checklist & Learning Path**
**Status:** ⚠️ PARTIALLY IMPLEMENTED  
**Scope:** New Feature  
**Type:** UX/Productivity

Auto-generated personalized onboarding paths for new developers.

**Planned Features:**
- Day-by-day learning schedule
- Entry point recommendations
- File reading order
- "Make first change" task suggestions
- Difficulty-based progression
- Achievement tracking and badges

**Current Implementation:**
- Task board exists (`Board`, `Column`, `Card` tables)
- Manual checklist creation

**Missing Elements:**
- AI-generated learning paths
- Difficulty assessment
- Achievement system
- Personalization by experience level

---

### **38. API Surface Map**
**Status:** ⚠️ PARTIALLY IMPLEMENTED  
**Scope:** New Feature  
**Type:** Documentation

Explicit mapping of service APIs and their relationships.

**Planned Features:**
- REST/GraphQL endpoint catalog
- Request/response schema documentation
- Client code generation (SDKs)
- API versioning and deprecation tracking
- Breaking change warnings
- Cross-service dependency map

**Current Implementation:**
- tRPC router structure exists
- API endpoints defined

**Missing Elements:**
- API documentation UI
- Request/response visualization
- Client code generation
- Breaking change detection

---

### **39. Slack/Discord/Teams Bot**
**Status:** ⚠️ NOT IMPLEMENTED  
**Scope:** New Feature  
**Type:** Integration

Bot for answering questions directly from Slack/Discord/Teams.

**Planned Features:**
- `@legacylens` question answering in chat
- Incident context export to channels
- Daily digest of code changes
- File explanation on demand
- Architecture queries from chat
- Runbook access from Slack

**Current Implementation:**
- None (planned feature)

**Technical Stack:**
- Slack Bolt SDK / Discord.py / Teams SDK
- tRPC endpoint for bot queries

---

### **40. VS Code Extension**
**Status:** ⚠️ NOT IMPLEMENTED  
**Scope:** New Feature  
**Type:** IDE Integration

LegacyLens features directly in VS Code.

**Planned Features:**
- "Open in LegacyLens" context menu
- In-editor file explanation hover
- Symbol search command
- Find usages command
- Architecture diagram in VS Code
- Blame + commit summary inline

**Current Implementation:**
- None (planned feature)

**Technical Stack:**
- VS Code Extension API
- tRPC calls to backend

---

### **41. Branch & PR Impact Analysis (Enhanced)**
**Status:** ⚠️ PARTIALLY IMPLEMENTED  
**Scope:** New Feature  
**Type:** Code Review

Detailed impact analysis for branches and PRs.

**Planned Enhancements:**
- "What changed" comparison
- Blast radius per file
- Risk percentage per change set
- Dependency impact visualization
- Breaking change detection
- Required reviewer suggestions

**Current Implementation:**
- `PullRequest` table exists
- `pullRequest.ts` router with basic features
- `githubPr.ts` service

**Missing Elements:**
- Breaking change detection
- Detailed diff analysis
- Risk scoring algorithm
- Integration with GitHub PR UI

---

### **42. Symbol Search & Cross-File Navigation**
**Status:** ⚠️ PARTIALLY IMPLEMENTED  
**Scope:** New Feature  
**Type:** Navigation

Search and navigate by symbol name across codebase.

**Planned Features:**
- Symbol search (functions, classes, variables)
- "Find all usages" of a symbol
- Cross-project symbol search
- Symbol definition navigation
- Import path optimization
- Symbol refactoring support

**Current Implementation:**
- Function/class extraction in parser
- Basic search capability

**Missing Elements:**
- Symbol search UI
- Find usages implementation
- Cross-project search
- Definition navigation

---

### **43. Multi-Repo / Workspace View**
**Status:** ⚠️ NOT IMPLEMENTED  
**Scope:** New Feature  
**Type:** Advanced Features

Treat multiple repositories as a single product.

**Planned Features:**
- Workspace concept (multiple repos)
- Cross-repo dependency mapping
- Unified search across repos
- Multi-repo Q&A
- Shared insights across repos
- Monorepo optimization

**Current Implementation:**
- Single project (`Project` model)
- No workspace concept

**Technical Stack:**
- Workspace model
- Multi-project indexing
- Cross-project embedding space

---

### **44. Scheduled Reports & Digests**
**Status:** ⚠️ NOT IMPLEMENTED  
**Scope:** New Feature  
**Type:** Analytics

Automated regular reports on codebase status.

**Planned Features:**
- Weekly health digest
- "What changed" email
- Team contribution summary
- Incident recap report
- Tech debt progress tracking
- Roadmap impact analysis

**Current Implementation:**
- None (planned feature)

**Technical Stack:**
- Scheduled jobs (BullMQ)
- Email service (SendGrid)
- Report generation service

---

### **45. Silent-Failure Hotspots Detection**
**Status:** ⚠️ PARTIALLY IMPLEMENTED  
**Scope:** New Feature  
**Type:** Code Quality

Identify high-risk patterns prone to silent failures.

**Planned Features:**
- Empty catch block detection
- Unhandled promise rejection detection
- External calls without timeout
- Missing error boundaries
- Swallowed exceptions detection
- Risky pattern flagging

**Current Implementation:**
- Pattern detection framework in place
- Security service (`security.ts`)

**Missing Elements:**
- Silent-failure specific patterns
- UI visualization
- Risk scoring
- Remediation suggestions

---

### **46. Config / Environment Variable Mapping**
**Status:** ⚠️ NOT IMPLEMENTED  
**Scope:** New Feature  
**Type:** DevOps

Map environment variables to their usage in code.

**Planned Features:**
- `process.env.*` detection
- Config file parsing (.env, YAML, JSON)
- Service-to-env-var mapping
- Missing env var detection
- Env var validation rules
- Config documentation generation

**Current Implementation:**
- None (planned feature)

**Technical Stack:**
- AST pattern matching
- Config file parser
- Env var tracking service

---

### **47. Incident Replays & Call Path Visualization**
**Status:** ⚠️ PARTIALLY IMPLEMENTED  
**Scope:** New Feature  
**Type:** DevOps

Reconstruct execution paths from stack traces.

**Planned Features:**
- Stack trace parsing
- Call path reconstruction (stack trace → code flow)
- Request path visualization (first endpoint → failure point)
- Mini architecture diagram for incident path
- Dependency path highlighting
- Timeline reconstruction from logs

**Current Implementation:**
- `incident.ts` service with basic support
- Stack trace parsing framework

**Missing Elements:**
- Call path visualization
- Request path reconstruction
- Timeline UI
- Log correlation

---

### **48. Same-Bug Pattern Search**
**Status:** ⚠️ NOT IMPLEMENTED  
**Scope:** New Feature  
**Type:** Code Quality

Find similar code patterns to avoid repeated bugs.

**Planned Features:**
- Semantic similarity search for bug patterns
- "Similar bugs existed here" suggestions
- Pattern library building
- Historical bug pattern matching
- Preventive fix suggestions
- Incident pattern tracking

**Current Implementation:**
- Embedding-based search exists
- Incident log exists

**Missing Elements:**
- Pattern library
- Bug pattern specific search
- Historical matching

---

### **49. One-Click Context Export**
**Status:** ⚠️ PARTIALLY IMPLEMENTED  
**Scope:** New Feature  
**Type:** Collaboration

Export incident context for sharing.

**Planned Features:**
- Generate shareable context links
- Export to Markdown
- Export to Slack/PagerDuty
- Include architecture snippet, recent changes, runbook
- Automated incident report generation
- Context pack versioning

**Current Implementation:**
- Context assembly logic exists
- Sharing framework in place

**Missing Elements:**
- Export UI
- Slack integration
- Report templating

---

### **50. Timeout & Retry Map**
**Status:** ⚠️ NOT IMPLEMENTED  
**Scope:** New Feature  
**Type:** Reliability

Map external calls and identify reliability risks.

**Planned Features:**
- External call detection (fetch, DB, Redis, APIs)
- Timeout configuration detection
- Retry logic detection
- Missing timeout flagging
- Missing retry flagging
- Reliability score per module
- Hanging code identification

**Current Implementation:**
- None (planned feature)

**Technical Stack:**
- AST pattern analysis
- External call detection rules

---

## 📊 Feature Status Summary

### By Implementation Status

| Status | Count | Categories |
|--------|-------|-----------|
| ✅ **Implemented** | 25 | Core features, basic infrastructure, some add-ons |
| ⚠️ **Partially Implemented** | 15 | Some features exist, enhancements needed |
| ❌ **Not Implemented** | 10 | Planned features, future roadmap |
| **TOTAL** | **50** | |

### By Feature Type

| Type | Count | Examples |
|------|-------|----------|
| **Core/User-Facing** | 12 | Q&A, Architecture, Meetings, Board, etc. |
| **Technical Infrastructure** | 10 | Auth, Database, Caching, Logging, Docker |
| **New Feature Add-ons** | 28 | Health Dashboard, Incident Mgmt, API Map, etc. |

### By Scope

| Scope | Count |
|-------|-------|
| **MVP/Core (Phase 1)** | 8 |
| **Growth Features (Phase 2-3)** | 20 |
| **Nice-to-Have/Future** | 22 |

---

## 🎯 Categorization Guide

### **TECHNICAL FEATURES** (Infrastructure, Architecture)
These are non-customer-facing features that enable the platform:

- Authentication & Authorization
- Database (PostgreSQL + pgvector)
- Vector Embeddings & Search
- GitHub Integration
- Background Job Processing
- Logging & Monitoring
- Error Handling & Observability
- Type Safety & Validation
- Caching Strategy
- Rate Limiting
- Cost Optimization
- Docker & Containerization
- Environment Management
- Build & Deployment Pipeline
- LLM Integration (Groq)

**Count:** ~15 technical features

---

### **NEW FEATURE ADD-ONS** (Built on Core Platform)
These are customer-facing features that extend the core platform:

- Incident Management & Runbooks
- Pull Request Analysis
- Health Dashboard & Tech Debt
- Refactor Suggestions
- Test Coverage Analysis
- Documentation Generation
- Security Analysis
- Team Collaboration
- Benchmarking & Model Evaluation
- "Fix It" PR Generation
- Slack/Discord Bots (planned)
- VS Code Extension (planned)
- Multi-Repo Workspaces (planned)
- Scheduled Reports (planned)
- Symbol Search (planned)
- Config/Env Mapping (planned)
- And 10+ more planned features

**Count:** ~25 new feature add-ons (some partially implemented)

---

### **CORE FEATURES** (MVP)
These are essential features that define the product:

1. **Instant Codebase Intelligence** — Code indexing & architecture
2. **AI-Powered Q&A** — Natural language code questions
3. **Visual Architecture Map** — Dependency graph visualization
4. **Task Board** — Onboarding progress tracking
5. **Meeting Intelligence** — Transcription & insight extraction
6. **Code Analysis & Dependency Graph** — Deep code understanding
7. **Project Management** — Multiple project support
8. **GitHub Integration** — OAuth & repo access
9. **Billing & Credits** — Monetization
10. **User Authentication** — Secure access

**Count:** ~10 core features

---

## 🗓️ Phased Delivery Roadmap

### **Phase 1 (MVP — Months 1-3)** ✅ ACHIEVED
**Status:** Complete

**Features Delivered:**
- Instant codebase intelligence
- AI-powered Q&A with RAG
- Architecture visualization
- Task board
- GitHub integration
- User authentication
- Meeting intelligence

**Metrics:**
- 500 signups
- 50 active projects
- 10 paying customers
- NPS > 40

---

### **Phase 2 (Growth — Months 4-6)** ⚠️ IN PROGRESS

**Planned Features:**
- Health dashboard & tech debt scoring
- Incident management & runbooks
- PR analysis & impact
- Pull request features
- Team collaboration
- Benchmarking framework
- Security analysis
- Test coverage analysis
- Documentation generation

**Metrics:**
- 2,000 signups
- 200 active projects
- 100 paying customers
- $2,000 MRR

---

### **Phase 3 (Scale — Months 7-12)** 🔮 FUTURE

**Planned Features:**
- Slack/Discord/Teams bot
- VS Code extension
- Multi-repo workspaces
- Scheduled reports & digests
- Advanced symbol search
- Cross-project search
- Onboarding checklist AI
- Silent-failure hotspots
- Config/env mapping
- Incident replay visualization
- Same-bug pattern search
- Context export & sharing
- Timeout/retry mapping

**Metrics:**
- 10,000 signups
- 1,000 active projects
- 500 paying customers
- $10,000 MRR
- 3 enterprise contracts

---

## 🔗 Feature Dependencies

```
Core Features (MVP)
├── Instant Codebase Intelligence ← Code Parser, GitHub Integration
├── AI-Powered Q&A ← Vector Search, LLM, Code Embeddings
├── Architecture Map ← Code Analyzer, Dependency Graph
├── Task Board ← Project Management
├── Meeting Intelligence ← Audio Processing, LLM, Embeddings
└── Authentication ← Clerk/OAuth

Phase 2 Features
├── Health Dashboard ← Code Parser, Analyzer, LLM
├── Incident Management ← Analyzer, Search, LLM
├── PR Analysis ← GitHub Integration, Analyzer
└── Team Collaboration ← Authentication, Project Management

Phase 3 Features
├── Slack Bot ← API, Q&A Service
├── VS Code Extension ← API, Search
├── Multi-Repo ← Project Management
├── Symbol Search ← Parser, Search
└── Config Mapping ← Parser, Analyzer
```

---

## 💡 Implementation Notes

### **Quick Wins (High Impact, Low Effort)**
1. **Enhanced Health Dashboard** → Already have metrics, just needs UI
2. **Context Export** → Use existing context assembly + markdown generator
3. **Config/Env Mapping** → Leverage existing parser + simple patterns
4. **Scheduled Reports** → BullMQ jobs + email service (easy integration)

### **Medium Effort (High Impact)**
1. **Slack/Discord Bot** → New integrations, reuse existing Q&A logic
2. **PR Impact Analysis** → Use existing dependency graph + analyzer
3. **Symbol Search** → Parser already extracts symbols, just needs search UI
4. **Silent-Failure Hotspots** → Add AST patterns to security scanner

### **High Effort (Awesome Features)**
1. **VS Code Extension** → New platform, but straightforward API calls
2. **Multi-Repo Workspaces** → Requires workspace model changes
3. **Incident Replay** → Complex stack trace parsing + path reconstruction
4. **Same-Bug Search** → Sophisticated pattern matching + incident learning

### **Continuous Improvements**
- Embed refactoring across codebase
- Expand security checks
- Improve health metrics accuracy
- Add more AI-assisted features
- Better visualization components

---

## 📈 Success Metrics by Feature

### **Core Features**
- **Indexing Speed:** <5 minutes for 10K files
- **Q&A Accuracy:** 90%+ correct answers
- **Architecture Visualization:** Sub-2s render
- **Onboarding Time:** Reduced 14 days → <2 days

### **Technical Features**
- **API Latency:** <200ms p95
- **Uptime:** 99.5% (MVP), 99.9% (Production)
- **Cost per Operations:** <$0.10 indexing, <$0.01 Q&A

### **New Feature Add-ons**
- **Health Dashboard:** Used by 60%+ of active projects
- **Incident Management:** Tracks 80%+ of incidents
- **PR Analysis:** Integrated into 40%+ of PRs
- **Team Collaboration:** 90%+ adoption in teams

---

## 🎓 Conclusion

**LegacyLens** comprises **50+ features** organized across:
- **10 core features** (MVP backbone)
- **15 technical infrastructure features** (enabling platform)
- **25 new feature add-ons** (expanding capabilities)

**Current Status:**
- ✅ 25 features fully implemented
- ⚠️ 15 features partially implemented  
- ❌ 10 features planned/future

**Next Focus:**
Phase 2 features include enhanced health dashboard, incident management, and team collaboration to drive growth metrics.

---

**Document Author:** LegacyLens Engineering Team  
**Last Updated:** February 18, 2026  
**Next Review:** After Phase 2 completion
