# Team Section - Review & Implementation Plan

## 📋 Your Requirements Review

You want a **Team section** (similar to Board) with:
1. ✅ **Team Progress** - Track team member progress
2. ✅ **Commits** - Show team commits
3. ✅ **Pull Requests (PRs)** - GitHub PR integration
4. ✅ **Assignment of Parts** - Task/file assignments
5. ⚠️ **Trello Board Integration** - External integration
6. ✅ **Meetings Space** - Already exists
7. ✅ **Real-time Chat** - Team & individual messaging

---

## 🔍 Current State Analysis

### ✅ Already Exists:
- **Meetings** (`/project/:id/meetings`) - Full meeting management
- **Board** (`/project/:id/board`) - Kanban with card assignments
- **History** (`/project/:id/history`) - Commit history
- **Team Members** - UserToProject model with roles (owner/admin/member/viewer)
- **Member Invites** - `project.inviteMember` endpoint

### ❌ Missing:
- **Team Dashboard** - Centralized team view
- **PR Integration** - GitHub PR fetching/display
- **Team Progress Tracking** - Member activity metrics
- **Real-time Chat** - WebSocket-based messaging
- **Trello Integration** - External API integration

---

## 💡 Recommendations & Prioritization

### 🟢 **HIGH PRIORITY** (Core Team Features)

#### 1. **Team Dashboard Page** (`/project/:id/team`)
**What:** Central hub showing team activity, progress, and collaboration

**Features:**
- **Team Members List** - Show all members with roles, avatar, join date
- **Activity Feed** - Recent commits, PRs, board card moves, Q&A activity
- **Progress Overview** - Per-member metrics:
  - Commits made
  - Cards completed (from Board)
  - Files explored (Q&A sessions)
  - Meetings attended
- **Quick Actions** - Invite member, view member profile

**Why:** Essential foundation for team collaboration

---

#### 2. **Enhanced Commits View** (Enhance existing History page)
**What:** Team-focused commit visualization

**Features:**
- **Group by Author** - Filter commits by team member
- **Commit Activity Heatmap** - Calendar view showing commit frequency
- **Team Stats** - "Top contributors this week", "Most active files"
- **Commit Threads** - Link commits to board cards or PRs

**Why:** Builds on existing History page, adds team context

---

#### 3. **Pull Requests Integration**
**What:** Fetch and display GitHub PRs

**Features:**
- **PR List** - Show open/closed PRs from GitHub
- **PR Details** - Title, description, files changed, reviewers
- **Link PRs to Board Cards** - Connect PRs to onboarding tasks
- **PR Activity** - Comments, reviews, status changes
- **Auto-sync** - Periodic refresh from GitHub API

**Why:** Critical for understanding team work in progress

**Implementation Notes:**
- Use GitHub API to fetch PRs
- Store PR metadata in new `PullRequest` model
- Sync via background job (every 15-30 min)

---

#### 4. **Real-time Chat** (Team & Individual)
**What:** WebSocket-based messaging

**Features:**
- **Team Channel** - Project-wide chat
- **Direct Messages** - 1-on-1 conversations
- **Mentions** - @username notifications
- **File/Code Snippets** - Share code blocks, file links
- **Message Threading** - Reply to specific messages
- **Presence** - Show who's online

**Why:** Essential for team coordination

**Implementation Notes:**
- Use Fastify WebSocket (already configured)
- New `Message` and `ChatChannel` models
- Real-time updates via WebSocket events

---

### 🟡 **MEDIUM PRIORITY** (Nice-to-Have)

#### 5. **Enhanced Assignment System**
**What:** Better task/file assignment tracking

**Features:**
- **File Assignments** - Assign files/modules to team members
- **Assignment Dashboard** - "Who's working on what"
- **Assignment History** - Track reassignments
- **Workload View** - See member capacity

**Why:** Improves existing Board assignment feature

---

#### 6. **Team Progress Analytics**
**What:** Detailed progress tracking

**Features:**
- **Onboarding Progress** - Track new member learning curve
- **Velocity Metrics** - Commits/week, cards completed/week
- **Knowledge Gaps** - "Files no one has explored"
- **Team Health** - Activity trends, engagement metrics

**Why:** Valuable for managers, but can come later

---

### 🔴 **LOW PRIORITY** (Consider Later)

#### 7. **Trello Board Integration**
**What:** Sync with external Trello boards

**Features:**
- **Trello OAuth** - Connect Trello account
- **Board Sync** - Import Trello cards
- **Bidirectional Sync** - Update both systems

**Why:** External dependency, complex, lower value
**Alternative:** Focus on improving native Board feature instead

---

## 🗄️ Database Schema Additions Needed

### New Models:

```prisma
// Pull Requests (GitHub)
model PullRequest {
  id          String   @id @default(uuid())
  projectId   String   @map("project_id")
  githubPrId  Int      @unique @map("github_pr_id") // GitHub PR number
  title       String
  body        String?  @db.Text
  state       String   // open, closed, merged
  author      String   // GitHub username
  authorEmail String?  @map("author_email")
  baseBranch  String   @map("base_branch")
  headBranch  String   @map("head_branch")
  filesChanged String[] @map("files_changed")
  reviewers   String[] // GitHub usernames
  mergedAt    DateTime? @map("merged_at")
  createdAt   DateTime @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  @@unique([projectId, githubPrId])
  @@index([projectId])
  @@index([state])
  @@map("pull_requests")
}

// Chat Channels (Team & DM)
model ChatChannel {
  id        String   @id @default(uuid())
  projectId String?  @map("project_id") // null for DMs
  type      String   // "team" | "dm"
  name      String?  // null for DMs
  
  project   Project? @relation(fields: [projectId], references: [id], onDelete: Cascade)
  members   ChatMember[]
  messages  Message[]
  
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  @@index([projectId])
  @@map("chat_channels")
}

model ChatMember {
  id        String   @id @default(uuid())
  channelId String   @map("channel_id")
  userId    String   @map("user_id")
  role      String   @default("member") // member, admin
  
  channel   ChatChannel @relation(fields: [channelId], references: [id], onDelete: Cascade)
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  joinedAt  DateTime @default(now()) @map("joined_at")
  
  @@unique([channelId, userId])
  @@index([userId])
  @@map("chat_members")
}

model Message {
  id        String   @id @default(uuid())
  channelId String   @map("channel_id")
  userId    String   @map("user_id")
  content   String   @db.Text
  mentions  String[] // User IDs mentioned
  replyToId String?  @map("reply_to_id") // Threading
  
  channel   ChatChannel @relation(fields: [channelId], references: [id], onDelete: Cascade)
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  replyTo   Message?   @relation("MessageReplies", fields: [replyToId], references: [id])
  replies    Message[]   @relation("MessageReplies")
  
  createdAt DateTime @default(now()) @map("created_at")
  
  @@index([channelId])
  @@index([userId])
  @@index([createdAt])
  @@map("messages")
}

// File Assignments
model FileAssignment {
  id        String   @id @default(uuid())
  projectId String   @map("project_id")
  filePath  String   @map("file_path")
  userId    String   @map("user_id")
  assignedBy String  @map("assigned_by") // User ID who assigned
  
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  createdAt DateTime @default(now()) @map("created_at")
  
  @@unique([projectId, filePath, userId])
  @@index([projectId])
  @@index([userId])
  @@map("file_assignments")
}

// Link PRs to Board Cards
model CardPullRequest {
  id        String   @id @default(uuid())
  cardId    String   @map("card_id")
  prId      String   @map("pr_id")
  
  card      Card         @relation(fields: [cardId], references: [id], onDelete: Cascade)
  pullRequest PullRequest @relation(fields: [prId], references: [id], onDelete: Cascade)
  
  createdAt DateTime @default(now()) @map("created_at")
  
  @@unique([cardId, prId])
  @@map("card_pull_requests")
}
```

### Updates to Existing Models:

```prisma
// Add to Project model
model Project {
  // ... existing fields
  pullRequests PullRequest[]
  chatChannels ChatChannel[]
  fileAssignments FileAssignment[]
}

// Add to Card model (if not exists)
model Card {
  // ... existing fields
  pullRequests CardPullRequest[]
}

// Add to User model
model User {
  // ... existing fields
  chatMembers ChatMember[]
  messages    Message[]
  fileAssignments FileAssignment[]
}
```

---

## 📁 File Structure

```
src/
├── pages/
│   ├── Team.tsx                    # NEW: Team dashboard
│   └── Chat.tsx                    # NEW: Chat interface
├── server/
│   ├── routers/
│   │   ├── team.ts                 # NEW: Team endpoints
│   │   ├── chat.ts                 # NEW: Chat endpoints
│   │   └── pullRequest.ts          # NEW: PR endpoints
│   └── services/
│       ├── githubPr.ts             # NEW: GitHub PR fetching
│       └── chatService.ts          # NEW: Chat logic
└── components/
    └── team/
        ├── TeamMemberCard.tsx      # NEW
        ├── ActivityFeed.tsx         # NEW
        ├── ProgressChart.tsx       # NEW
        └── ChatWindow.tsx          # NEW
```

---

## 🚀 Implementation Phases

### Phase 1: Foundation (Week 1)
1. ✅ Create Team page route (`/project/:id/team`)
2. ✅ Add Team nav item to DashboardLayout
3. ✅ Create `teamRouter` with basic endpoints
4. ✅ Display team members list
5. ✅ Show basic activity feed (commits, board cards)

### Phase 2: PR Integration (Week 2)
1. ✅ Add PullRequest model to schema
2. ✅ Create GitHub PR fetching service
3. ✅ Add PR sync background job
4. ✅ Display PRs in Team page
5. ✅ Link PRs to board cards

### Phase 3: Chat System (Week 3-4)
1. ✅ Add ChatChannel, ChatMember, Message models
2. ✅ Set up WebSocket server
3. ✅ Create chat router endpoints
4. ✅ Build Chat UI component
5. ✅ Add real-time message updates
6. ✅ Implement mentions & threading

### Phase 4: Enhanced Features (Week 5+)
1. ✅ File assignments
2. ✅ Progress analytics
3. ✅ Activity heatmaps
4. ✅ Team health metrics

---

## 🎯 Recommended Starting Point

**Start with Phase 1** - Build the Team dashboard foundation:

1. **Team Page** - Show members, basic activity
2. **Enhanced Commits** - Add team filtering to History page
3. **PR Integration** - Fetch and display PRs (Phase 2)

**Skip Trello Integration** for now - focus on native features first.

---

## 💬 Questions to Consider

1. **Chat Scope:** Team channel only, or also DMs?
   - **Recommendation:** Start with team channel, add DMs later

2. **PR Sync Frequency:** Real-time webhooks or polling?
   - **Recommendation:** Polling every 15-30 min (simpler, GitHub rate limits)

3. **Activity Feed:** What events to track?
   - **Recommendation:** Commits, PRs, Board card moves, Q&A questions, Meetings

4. **Progress Metrics:** What matters most?
   - **Recommendation:** Commits/week, cards completed, files explored

---

## ✅ Final Recommendation

**Build in this order:**

1. ✅ **Team Dashboard** (`/project/:id/team`) - Foundation
2. ✅ **PR Integration** - High value, uses existing GitHub API
3. ✅ **Real-time Chat** - Essential for collaboration
4. ⏸️ **File Assignments** - Enhance existing Board
5. ⏸️ **Progress Analytics** - Nice-to-have, can come later
6. ❌ **Trello Integration** - Skip for now, focus on native Board

This gives you a solid team collaboration hub without overcomplicating things!
