# Product Requirements Document (PRD)
# LegacyLens — Legacy Code Intelligence Platform

**Version:** 1.0  
**Last Updated:** February 10, 2026  
**Product Owner:** DevSync Team  
**Target Launch:** Q2 2026 (MVP in 8 weeks)

---

## 📋 Executive Summary

### Product Vision
**"Onboard to any codebase in hours, not weeks."**

LegacyLens is an AI-powered platform that transforms how developers understand inherited, legacy, and unfamiliar codebases. By combining semantic code analysis, architecture visualization, task management, and AI-powered insights, we reduce onboarding time from weeks to hours.

### Target Market
- **Primary:** Software consultancies, dev agencies, contract developers
- **Secondary:** New hires at tech companies, open-source contributors, technical due diligence teams
- **Tertiary:** Engineering managers onboarding teams to legacy systems

### Market Size
- 23M professional developers worldwide (Stack Overflow 2024)
- 68% spend >30% time understanding existing code (DevProductivity Survey)
- Average developer onboarding cost: $28,000 per person
- **TAM:** $8.2B (developer productivity tools market)

### Competitive Advantage
**We're NOT competing with Cursor/Copilot (coding assistants).**  
**We ARE the "StackOverflow + Trello + Architecture Diagram" for legacy codebases.**

| Feature | Cursor/Copilot | Sourcegraph | LegacyLens |
|---------|----------------|-------------|------------|
| Code autocomplete | ✅ | ❌ | ❌ |
| Code search | Limited | ✅ | ✅ |
| Architecture visualization | ❌ | ❌ | ✅ |
| "Why was this built?" AI | ❌ | ❌ | ✅ |
| Task management integration | ❌ | ❌ | ✅ |
| Onboarding-focused UX | ❌ | ❌ | ✅ |
| Meeting → Code linking | ❌ | ❌ | ✅ |

---

## 🎯 Goals & Success Metrics

### North Star Metric
**"Time to First Meaningful Contribution" — reduce from 14 days to <2 days**

### Key Performance Indicators (KPIs)

**Phase 1 (MVP — Months 1-3):**
- 500 total signups
- 50 active projects indexed
- 10 paying customers ($20/mo each)
- NPS > 40

**Phase 2 (Growth — Months 4-6):**
- 2,000 total signups
- 200 active projects
- 100 paying customers
- $2,000 MRR
- <5% churn rate

**Phase 3 (Scale — Months 7-12):**
- 10,000 total signups
- 1,000 active projects
- 500 paying customers
- $10,000 MRR
- 3 enterprise contracts ($500/mo each)

---

## 👥 User Personas

### Persona 1: **Consultant Chris** (Primary)
**Demographics:**
- 28-35 years old, Senior Developer
- Works at dev agency (10-50 employees)
- Handles 3-5 client projects simultaneously
- Budget: Company pays for tools

**Pain Points:**
- Inherits messy codebases with zero documentation
- Wastes 2-3 days per project just understanding architecture
- Clients expect fast turnaround
- Can't find where bugs actually originate
- Legacy code has no comments or context

**Goals:**
- Understand new codebase in <1 day
- Find critical files/functions quickly
- Know "why" code was written (not just "what")
- Estimate effort accurately
- Avoid breaking existing functionality

**How LegacyLens Helps:**
- Upload repo → get instant architecture map
- AI explains rationale behind design decisions
- Visual dependency graph shows blast radius
- Task board tracks "understand X" → "fix X"
- Meeting notes linked to code sections

---

### Persona 2: **New Hire Nina** (Secondary)
**Demographics:**
- 24-30 years old, Mid-level Developer
- Just joined established company (50+ employees)
- Assigned to maintain critical legacy system
- Budget: Personal ($20/mo acceptable if life-changing)

**Pain Points:**
- Overwhelmed by massive codebase (100K+ lines)
- Senior devs too busy to explain everything
- Documentation outdated or missing
- Afraid to make changes (might break production)
- Takes 4-6 weeks to feel productive

**Goals:**
- Get productive in first 2 weeks
- Understand codebase structure quickly
- Know which files are "dangerous" to touch
- Learn team conventions and patterns
- Build confidence in making changes

**How LegacyLens Helps:**
- Interactive "Codebase Tour" guide
- Highlights critical vs. safe-to-modify files
- Explains naming conventions and patterns
- Links onboarding docs to actual code
- Tracks progress: "80% of codebase understood"

---

### Persona 3: **Engineering Manager Emma** (Tertiary)
**Demographics:**
- 32-45 years old, Team Lead / EM
- Manages 5-10 developers
- Responsible for onboarding process
- Budget: Department budget ($100-500/mo)

**Pain Points:**
- Onboarding new devs takes too long
- Senior devs spend too much time explaining code
- No standardized onboarding process
- Can't measure onboarding effectiveness
- High turnover due to overwhelming legacy systems

**Goals:**
- Reduce onboarding time by 50%
- Free up senior devs from repetitive explanations
- Standardize knowledge across team
- Track new hire progress
- Retain developers longer

**How LegacyLens Helps:**
- Team workspace with shared insights
- Pre-generated onboarding guides for repos
- Analytics: "Nina understood 80% in 3 days"
- Centralized documentation auto-updated
- Meeting notes preserved for new hires

---

## 🚀 Core Features (MVP — Phase 1)

### Feature 1: **Instant Codebase Intelligence**

**User Story:**  
*"As Consultant Chris, I want to upload a GitHub repo and get an instant overview, so I can understand the architecture in 10 minutes instead of 2 days."*

**Acceptance Criteria:**
- ✅ User connects GitHub repo (OAuth)
- ✅ System indexes repo in <5 minutes (up to 10K files)
- ✅ Generates automatic:
  - Architecture diagram (visual component map)
  - Technology stack detection
  - Key file/folder summary
  - Entry points (main.py, index.js, etc.)
- ✅ Shows indexing progress bar
- ✅ Supports: Python, JavaScript/TypeScript, Java, Go, Ruby, PHP, C#

**Technical Requirements:**
- Parser: Tree-sitter for AST parsing
- Embeddings: Cohere Embed v3 (cheap, fast)
- Vector DB: Qdrant Cloud (1M vectors free tier)
- Background job: BullMQ + Redis
- Max repo size: 10,000 files (MVP limit)

**UI/UX:**
```
┌─────────────────────────────────────────┐
│ 🔍 Enter GitHub Repo URL                │
│ https://github.com/user/legacy-app      │
│                                         │
│         [Analyze Codebase] →            │
└─────────────────────────────────────────┘

[Processing... 2,340 / 2,890 files]
▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░ 81%

Estimated time: 45 seconds
```

**Success Metrics:**
- Indexing completes in <5 min for 90% of repos
- User views architecture diagram within 2 minutes
- 80% of users say "this saved me hours"

---

### Feature 2: **AI-Powered Q&A — "Why Does This Code Exist?"**

**User Story:**  
*"As New Hire Nina, I want to ask 'Why is authentication handled in middleware.js?' and get context, so I understand the rationale behind design decisions."*

**Acceptance Criteria:**
- ✅ User asks natural language questions
- ✅ AI searches codebase semantically
- ✅ Returns answer with:
  - Relevant code snippets
  - File locations (clickable links to GitHub)
  - Likely rationale (inferred from code + comments + commits)
  - Related functions/classes
- ✅ Streaming response (shows answer as it generates)
- ✅ Answer cites specific files and line numbers

**Example Questions:**
- "Why is authentication handled this way?"
- "What's the purpose of the /utils folder?"
- "How does the payment flow work?"
- "Where should I add new API endpoints?"
- "What files handle user permissions?"

**Technical Requirements:**
- LLM: Groq (Mixtral 8x7B) — fast + cheap
- RAG pipeline: Embed query → Qdrant search → Rerank top 10 → LLM context
- Context window: 8K tokens max
- Response streaming: SSE (Server-Sent Events)
- Caching: Redis (cache repeated queries for 1 hour)

**UI/UX:**
```
┌─────────────────────────────────────────┐
│ 💬 Ask anything about this codebase...  │
│                                         │
│ "Why is auth handled in middleware?"    │
│                                         │
│ [Ask] →                                 │
└─────────────────────────────────────────┘

🤖 LegacyLens:
Authentication is centralized in `src/middleware/auth.js` 
to enforce consistent security checks across all routes.

📄 Relevant files:
• src/middleware/auth.js (lines 12-45)
• src/routes/api.js (line 8 - imports middleware)
• config/passport.js (passport strategy setup)

💡 Why: Centralizing auth logic prevents duplication 
and ensures every endpoint is protected by default.

🔗 [View in GitHub →]
```

**Success Metrics:**
- 90% of questions answered correctly
- Average response time <3 seconds
- 70% of users ask >5 questions per session
- Users rate answers 4+ stars (out of 5)

---

### Feature 3: **Visual Architecture Map**

**User Story:**  
*"As Consultant Chris, I want to see how components connect, so I know which files are critical and what depends on what."*

**Acceptance Criteria:**
- ✅ Auto-generates interactive dependency graph
- ✅ Shows:
  - File/module nodes
  - Import/export relationships
  - Component hierarchy
  - External dependencies (npm, pip packages)
- ✅ Visual indicators:
  - 🔴 Critical files (>10 dependents)
  - 🟡 Medium risk (5-10 dependents)
  - 🟢 Safe to modify (<5 dependents)
- ✅ Click on node → see file details + Q&A
- ✅ Filter by: folder, file type, keyword

**Technical Requirements:**
- Graph generation: Madge (for JS), pydeps (Python), or custom parser
- Visualization: D3.js force-directed graph or Cytoscape.js
- Backend: Pre-compute graph during indexing
- Store: Graph JSON in PostgreSQL JSONB column

**UI/UX:**
```
┌─────────────────────────────────────────┐
│  📊 Architecture Map                    │
│                                         │
│        ┌─────────┐                      │
│        │ index.js│ (entry point)        │
│        └────┬────┘                      │
│             │                           │
│      ┌──────┴──────┐                    │
│      │             │                    │
│  ┌───▼───┐   ┌────▼────┐               │
│  │ auth  │   │ routes  │               │
│  └───┬───┘   └────┬────┘               │
│      │            │                     │
│  ┌───▼───┐   ┌───▼───┐                 │
│  │  db   │   │  api  │ 🔴 (critical)   │
│  └───────┘   └───────┘                 │
│                                         │
│  Filter: [All] [Frontend] [Backend]    │
└─────────────────────────────────────────┘
```

**Success Metrics:**
- Graph loads in <2 seconds
- 85% of users interact with graph
- Users identify critical files 5x faster

---

### Feature 4: **Task Board Integration (Trello-style)**

**User Story:**  
*"As Engineering Manager Emma, I want to track onboarding tasks (like 'Understand auth flow') and link them to code sections, so I can see progress and ensure nothing is missed."*

**Acceptance Criteria:**
- ✅ Built-in Kanban board per project
- ✅ Default columns:
  - 📝 To Learn
  - 🔍 Exploring
  - ✅ Understood
  - 🛠️ Ready to Modify
- ✅ Create cards like:
  - "Understand authentication"
  - "Map payment processing"
  - "Fix login bug"
- ✅ Each card links to:
  - Specific files/folders
  - Q&A conversations
  - Architecture diagram nodes
- ✅ Auto-suggest tasks based on codebase (AI-generated)
- ✅ Track time spent per task
- ✅ Team view: see all members' progress

**Technical Requirements:**
- DB: PostgreSQL (Board, Column, Card models)
- Real-time: WebSockets (Socket.io or Supabase Realtime)
- Drag-and-drop: react-beautiful-dnd or dnd-kit
- AI task suggestions: LLM generates common onboarding tasks

**UI/UX:**
```
┌─────────────────────────────────────────────────────────────┐
│ 📋 Onboarding Board — legacy-ecommerce-app                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📝 To Learn     🔍 Exploring     ✅ Understood     🛠️ Ready │
│                                                             │
│  ┌─────────┐    ┌─────────┐     ┌─────────┐              │
│  │ Auth    │    │ Payment │     │ Database│              │
│  │ flow    │    │ process │     │ schema  │              │
│  │         │    │ 🔗 3 files│    │ ✓ Done  │              │
│  └─────────┘    └─────────┘     └─────────┘              │
│                                                             │
│  ┌─────────┐                                               │
│  │ API     │                                               │
│  │ routes  │                                               │
│  └─────────┘                                               │
│                                                             │
│  [+ Add Task]                                              │
└─────────────────────────────────────────────────────────────┘
```

**Success Metrics:**
- 60% of users create at least 1 board
- Average 8 tasks per board
- Task completion rate >70%
- Users report "much more organized" (survey)

---

### Feature 5: **Meeting → Code Linking**

**User Story:**  
*"As Consultant Chris, I want to upload meeting recordings where the client explained the system, and have those insights linked to relevant code, so I don't forget important context."*

**Acceptance Criteria:**
- ✅ Upload audio/video meeting files
- ✅ Auto-transcribe with timestamps
- ✅ AI extracts:
  - Decisions made
  - Technical explanations
  - Action items
  - Risks/concerns mentioned
- ✅ Links transcript sections to code files
- ✅ Searchable: "Find when we discussed auth"
- ✅ Appears in Q&A context when relevant

**Technical Requirements:**
- Transcription: Groq Whisper API (cheapest + fast)
- Storage: Backblaze B2 (10x cheaper than S3)
- Processing: Background worker (BullMQ job)
- Linking: Embed transcript chunks → match with code embeddings
- DB: Meeting, Transcript, TranscriptChunk models

**UI/UX:**
```
┌─────────────────────────────────────────┐
│ 🎙️ Meetings                             │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Client Kickoff Call             │   │
│  │ Jan 15, 2026 • 45 min           │   │
│  │                                 │   │
│  │ 📝 Key Points:                  │   │
│  │ • Auth uses JWT (12:30)         │   │
│  │ • Payment via Stripe (23:45)    │   │
│  │ • Old DB schema needs cleanup   │   │
│  │                                 │   │
│  │ 🔗 Linked to:                   │   │
│  │ • src/auth/jwt.js               │   │
│  │ • models/payment.js             │   │
│  │                                 │   │
│  │ [View Transcript →]             │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [+ Upload Meeting]                    │
└─────────────────────────────────────────┘
```

**Success Metrics:**
- 40% of users upload at least 1 meeting
- 90% transcription accuracy
- Users reference meetings while coding (analytics)

---

## 🎨 User Experience & Design Principles

### Core UX Philosophy
**"Show, don't tell. Answer, don't overwhelm."**

### Design Principles

1. **Information Hierarchy**
   - Most critical info first (architecture map, key files)
   - Progressive disclosure (expand for details)
   - Never show raw data dumps

2. **Speed Over Perfection**
   - Streaming responses (show partial answers)
   - Load skeleton screens
   - Async indexing with progress bars

3. **Visual > Text**
   - Architecture diagram beats text lists
   - Code syntax highlighting
   - Color-coded file risk levels

4. **Contextual Help**
   - Inline tips: "💡 Tip: Critical files have >10 dependents"
   - Empty states suggest next action
   - Sample questions if user unsure

5. **Mobile-Friendly (Progressive)**
   - MVP: Desktop-first
   - Phase 2: Responsive mobile view
   - Phase 3: Native mobile app (if demand exists)

---

## 🔐 Security & Privacy

### Data Handling
- **Repos:** Clone to temporary directory → process → delete (never stored permanently)
- **Code embeddings:** Stored encrypted at rest (AES-256)
- **User data:** GDPR compliant, delete on request
- **Meetings:** User can delete anytime

### Access Control
- **Project ownership:** Creator = admin
- **Team members:** Invite-only with roles (viewer, editor, admin)
- **API keys:** Stored hashed, rotated every 90 days
- **Public repos:** Optional "make discoverable" feature (opt-in)

### Compliance
- SOC 2 Type II (roadmap for enterprise)
- GDPR compliant
- No third-party analytics (privacy-first)

---

## 💰 Pricing & Business Model

### Freemium Model

**Free Tier** (Hook users)
- 1 project
- Up to 5,000 files
- 20 questions/month
- 1 meeting upload/month
- 7-day data retention
- Community support (Discord)

**Pro** — $29/month (Target: Consultant Chris, Nina)
- 10 projects
- Up to 50,000 files per project
- Unlimited questions
- 10 meetings/month
- Architecture visualization (advanced)
- Task board with automation
- 30-day data retention
- Email support (24hr response)

**Team** — $99/month (Target: Engineering Manager Emma)
- Unlimited projects
- Unlimited files
- Unlimited questions
- Unlimited meetings
- Team collaboration (up to 10 members)
- Shared insights & boards
- SSO (Google/GitHub)
- 90-day data retention
- Priority support (4hr response)

**Enterprise** — Custom (Target: Large companies)
- Self-hosted option
- Custom integrations (Jira, Confluence, Slack)
- Dedicated success manager
- SLA guarantees (99.9% uptime)
- Unlimited everything
- Advanced security (audit logs, SSO with SAML)
- Custom contract

### Monetization Strategy

**Year 1:**
- Focus on Pro tier (easiest conversion)
- Offer annual discount (2 months free → $290/year)
- Referral bonuses: Give 1 month free for each referral

**Year 2:**
- Upsell Pro → Team (team features)
- Launch marketplace (community-built plugins)
- Affiliate program (10% commission for dev influencers)

**Year 3:**
- Enterprise sales team
- Custom consulting (codebase audits)
- API access for third-party tools

---

## 📊 Go-to-Market Strategy

### Phase 1: Launch (Months 1-3)

**Target:** 500 signups, 50 active users, 10 paying

**Channels:**
1. **Product Hunt Launch**
   - Prep: 2 weeks before launch
   - Goal: #1 Product of the Day
   - Offer: Lifetime 50% off for first 100 users

2. **Hacker News (Show HN)**
   - Title: "Show HN: Understand any legacy codebase in hours, not weeks"
   - Post on Tuesday 9 AM PT (best engagement)
   - Engage with every comment

3. **Reddit**
   - r/webdev, r/programming, r/cscareerquestions
   - Post as "I built a tool to help onboard to messy codebases"
   - Share genuinely, not spammy

4. **Dev.to / Hashnode**
   - Technical blog: "How we built LegacyLens using pgvector and Groq"
   - SEO-optimized content

5. **YouTube**
   - "I analyzed 100 open-source repos — here's what we learned"
   - Demo video: "Onboard to React codebase in 10 minutes"

**Content Calendar (Weeks 1-12):**
- Week 1-2: Pre-launch hype (Twitter threads, waitlist)
- Week 3: Product Hunt launch
- Week 4: Hacker News Show HN
- Week 5-6: Reddit posts + Dev.to articles
- Week 7-8: YouTube demos + case studies
- Week 9-12: User testimonials + referral push

---

### Phase 2: Growth (Months 4-6)

**Target:** 2,000 signups, 200 active, 100 paying

**Channels:**
1. **SEO Content**
   - "Best tools for understanding legacy code"
   - "How to onboard developers faster"
   - "Legacy code documentation tools comparison"
   - Target 50 blog posts (3/week)

2. **Partnerships**
   - Dev bootcamps (offer free for students)
   - Consulting agencies (B2B deals)
   - Open-source projects (free for OSS maintainers)

3. **Webinars**
   - "Legacy Code Best Practices" (weekly)
   - Invite CTOs, engineering managers
   - Soft sell at end

4. **Email Drip Campaign**
   - Day 1: Welcome + quick start guide
   - Day 3: "Did you analyze your first repo?"
   - Day 7: Case study (how others use it)
   - Day 14: Upgrade prompt (Pro trial)
   - Day 30: Win-back campaign

---

### Phase 3: Scale (Months 7-12)

**Target:** 10,000 signups, 1,000 active, 500 paying

**Channels:**
1. **Sales Team (B2B)**
   - Hire 1 SDR (Sales Development Rep)
   - Cold outreach to dev agencies (500+ employees)
   - LinkedIn Sales Navigator campaigns

2. **Conferences**
   - Booth at: ReactConf, NodeConf, PyCon
   - Sponsor local meetups (cheaper)

3. **Integration Marketplace**
   - Build: Jira, Linear, Notion integrations
   - Partners co-market

4. **Affiliate Program**
   - Recruit dev YouTubers (10-100K subs)
   - 20% commission for first 3 months
   - Provide demo accounts + talking points

---

## 🛠️ Technical Architecture (High-Level)

*(Detailed in separate Architecture doc)*

### Tech Stack Summary

**Frontend:**
- React 19 + Vite
- TailwindCSS + shadcn/ui
- React Query (data fetching)
- Zustand (state management)

**Backend:**
- Node.js + Fastify (API server)
- tRPC (type-safe API)
- Prisma ORM + PostgreSQL
- BullMQ + Redis (job queue)

**AI/ML:**
- Groq API (LLM inference — Mixtral 8x7B)
- Cohere Embed v3 (embeddings)
- Qdrant Cloud (vector DB)
- Groq Whisper (transcription)

**Infrastructure:**
- Hosting: Fly.io (Docker containers)
- Database: Supabase (PostgreSQL + Auth)
- Storage: Backblaze B2
- CDN: Cloudflare
- Monitoring: Sentry + Betterstack

**DevOps:**
- CI/CD: GitHub Actions
- Staging + Production environments
- Docker + docker-compose for local dev

---

## 🚧 Development Roadmap

### MVP (Weeks 1-8)

**Week 1-2: Setup & Infrastructure**
- Project scaffolding (Vite + Fastify)
- Database schema design
- Auth setup (Supabase Auth)
- CI/CD pipeline (GitHub Actions)

**Week 3-4: Core Indexing**
- GitHub OAuth integration
- Repo cloning worker
- File parsing (Tree-sitter)
- Embedding generation (Cohere)
- Vector storage (Qdrant)

**Week 5-6: Q&A System**
- RAG pipeline (query → search → rerank → LLM)
- Streaming responses (SSE)
- UI for Q&A interface
- Caching layer (Redis)

**Week 7: Visualization**
- Dependency graph generation
- D3.js interactive diagram
- Critical file detection

**Week 8: Polish & Launch**
- Onboarding flow
- Billing integration (Stripe)
- Bug fixes
- Product Hunt prep

---

### Post-MVP (Weeks 9-16)

**Week 9-10: Task Board**
- Kanban board UI
- Drag-and-drop
- Task ↔ code linking

**Week 11-12: Meeting Intelligence**
- Audio upload
- Transcription (Groq Whisper)
- Insight extraction
- Meeting ↔ code linking

**Week 13-14: Team Features**
- Multi-user workspaces
- Permissions & roles
- Shared boards

**Week 15-16: Enterprise Prep**
- SSO (SAML)
- Audit logs
- Self-hosted docs

---

## ✅ Success Criteria & KPIs

### User Acquisition
- Month 1: 100 signups
- Month 3: 500 signups
- Month 6: 2,000 signups
- Month 12: 10,000 signups

### Activation Rate
- 60% upload at least 1 repo
- 40% ask at least 5 questions
- 30% create task board

### Retention
- Day 7: 50% return
- Day 30: 30% return
- Month 3: 20% still active

### Revenue
- Month 3: $200 MRR
- Month 6: $2,000 MRR
- Month 12: $10,000 MRR

### NPS (Net Promoter Score)
- Target: >40 (good)
- Stretch: >60 (excellent)

---

## 🚨 Risks & Mitigation

### Risk 1: **AI Costs Spiral**
**Impact:** High  
**Probability:** Medium  
**Mitigation:**
- Set hard rate limits per user
- Cache aggressively (1hr TTL)
- Use cheapest models (Groq, Cohere)
- Monitor spend daily (alert at $500/mo)

### Risk 2: **Users Don't See Value Quickly**
**Impact:** High  
**Probability:** Medium  
**Mitigation:**
- Onboarding tutorial (interactive)
- Sample repos pre-indexed (demo mode)
- Email drip with tips (Days 1, 3, 7)
- Proactive support (Intercom chat)

### Risk 3: **Competitors Copy Features**
**Impact:** Medium  
**Probability:** High  
**Mitigation:**
- Build community (Discord, blog)
- Unique positioning (legacy focus)
- Speed of iteration (weekly releases)
- Network effects (team workspaces)

### Risk 4: **GitHub Rate Limits**
**Impact:** Medium  
**Probability:** High  
**Mitigation:**
- Multiple GitHub Apps (rotate tokens)
- Cache repo data (24hr TTL)
- Allow manual zip upload (fallback)

### Risk 5: **Privacy Concerns (Enterprise)**
**Impact:** High (for enterprise sales)  
**Probability:** Low (MVP), High (enterprise)  
**Mitigation:**
- Self-hosted option (roadmap)
- SOC 2 compliance
- Data deletion guarantees
- Public trust page (uptime, security)

---

## 📝 Open Questions

1. **Should we support private repos in Free tier?**
   - Pro: Drives signups
   - Con: Expensive to index/store
   - **Decision:** Yes, but limit to 1 repo, 5K files

2. **How to handle monorepos (>100K files)?**
   - Option A: Hard limit (reject)
   - Option B: Sample files intelligently
   - Option C: Enterprise-only feature
   - **Decision:** Option B (smart sampling for Pro+)

3. **Should we build IDE plugins (VS Code extension)?**
   - Pro: Compete directly with Cursor
   - Con: Different positioning, resource-intensive
   - **Decision:** Not MVP. Evaluate in Month 6.

4. **Meeting feature: Live transcription or upload-only?**
   - Live: More complex, higher cost
   - Upload: Simpler, async processing
   - **Decision:** Upload-only for MVP. Live in Phase 2.

5. **Should we open-source any components?**
   - Pro: Marketing, community, trust
   - Con: Competitive risk
   - **Decision:** Open-source dev tools (e.g., tree-sitter parsers), keep core closed

---

## 📚 Appendix

### A. Competitive Analysis
*(See separate doc: `Competitive_Analysis.md`)*

### B. Technical Architecture
*(See: `System_Architecture.md`, `LLD.md`, `HLD.md`)*

### C. User Research
*(See: `User_Interviews_Summary.md`)*

### D. Financial Projections
*(See: `Financial_Model.xlsx`)*

---

**Document Version History:**
- v1.0 (Feb 10, 2026): Initial PRD — MVP scope defined
- v1.1 (TBD): Post-MVP feedback incorporated

**Approval:**
- [ ] Product Owner
- [ ] Engineering Lead
- [ ] Design Lead
- [ ] Marketing Lead

---

**Next Steps:**
1. Review & approve PRD (target: 1 week)
2. Begin technical architecture (parallel track)
3. Design mockups (Figma)
4. Setup dev environment (Week 1)
5. Sprint 1 kickoff (Week 2)
