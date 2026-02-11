# Low-Level Design (LLD)
# LegacyLens — Technical Implementation Specification

**Version:** 1.0  
**Last Updated:** February 10, 2026  
**Owner:** Engineering Team

---

## 📦 Complete Database Schema (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================
// USER & AUTHENTICATION
// ============================================================

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  avatarUrl String?  @map("avatar_url")
  
  // GitHub integration
  githubId       String?  @unique @map("github_id")
  githubToken    String?  @map("github_token")  // Encrypted
  githubUsername String?  @map("github_username")
  
  // Billing
  credits          Int      @default(1000)
  subscriptionTier String   @default("free") @map("subscription_tier")  // free, pro, team, enterprise
  
  // Relations
  projects      UserToProject[]
  qaConversations QAConversation[]
  assignedCards Card[]       @relation("AssignedCards")
  subscriptions Subscription[]
  usageLogs     UsageLog[]
  
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  @@map("users")
}

// ============================================================
// PROJECTS
// ============================================================

model Project {
  id   String @id @default(uuid())
  name String
  
  // GitHub repo
  githubUrl      String?  @map("github_url")
  githubRepoId   String?  @map("github_repo_id")
  defaultBranch  String   @default("main") @map("default_branch")
  lastSyncedAt   DateTime? @map("last_synced_at")
  
  // Indexing status
  status          String  @default("pending")  // pending, indexing, complete, failed
  totalFiles      Int     @default(0) @map("total_files")
  processedFiles  Int     @default(0) @map("processed_files")
  totalLines      Int     @default(0) @map("total_lines")
  indexingError   String? @map("indexing_error")
  
  // Generated artifacts
  architectureJson Json?   @map("architecture_json")  // Dependency graph
  techStack        Json?   @map("tech_stack")         // { languages: [], frameworks: [] }
  entryPoints      String[] @map("entry_points")      // ["/src/index.js", "/main.py"]
  
  // Relations
  members       UserToProject[]
  files         File[]
  commits       Commit[]
  qaConversations QAConversation[]
  meetings      Meeting[]
  boards        Board[]
  
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  @@map("projects")
  @@index([status])
}

// Many-to-many: Users <-> Projects
model UserToProject {
  id     String @id @default(uuid())
  userId String @map("user_id")
  projectId String @map("project_id")
  role   String @default("member")  // owner, admin, member, viewer
  
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  joinedAt DateTime @default(now()) @map("joined_at")
  
  @@unique([userId, projectId])
  @@map("user_to_project")
  @@index([projectId])
  @@index([userId])
}

// ============================================================
// FILES & CODE STRUCTURE
// ============================================================

model File {
  id        String @id @default(uuid())
  projectId String @map("project_id")
  
  // File metadata
  filePath    String @map("file_path")  // relative to repo root
  fileType    String @map("file_type")  // js, ts, py, java, etc.
  linesOfCode Int    @map("lines_of_code")
  
  // Parsed structure
  functions Json?  // [{ name, params, lineStart, lineEnd }]
  classes   Json?  // [{ name, methods, lineStart, lineEnd }]
  imports   Json?  // [{ module, items }]
  exports   Json?  // [{ name, type }]
  
  // Dependency analysis
  isEntryPoint     Boolean @default(false) @map("is_entry_point")
  riskLevel        String  @default("low") @map("risk_level")  // low, medium, high, critical
  dependentsCount  Int     @default(0) @map("dependents_count")  // How many files import this
  dependenciesCount Int    @default(0) @map("dependencies_count")  // How many files this imports
  
  // Relations
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  @@unique([projectId, filePath])
  @@map("files")
  @@index([projectId])
  @@index([riskLevel])
}

// ============================================================
// COMMITS (for history & context)
// ============================================================

model Commit {
  id        String @id @default(uuid())
  projectId String @map("project_id")
  
  commitHash String @map("commit_hash")
  message    String
  author     String
  authorEmail String @map("author_email")
  committedAt DateTime @map("committed_at")
  
  // Files changed
  filesChanged String[]  @map("files_changed")
  
  // Relations
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  createdAt DateTime @default(now()) @map("created_at")
  
  @@unique([projectId, commitHash])
  @@map("commits")
  @@index([projectId])
  @@index([committedAt])
}

// ============================================================
// Q&A CONVERSATIONS
// ============================================================

model QAConversation {
  id        String @id @default(uuid())
  projectId String @map("project_id")
  userId    String @map("user_id")
  
  question String
  answer   String?
  
  // Context used
  contextFiles Json?  @map("context_files")  // [{ path, snippet, score }]
  
  // Performance
  responseTimeMs Int?  @map("response_time_ms")
  tokenCount     Int?  @map("token_count")
  
  // Relations
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  createdAt DateTime @default(now()) @map("created_at")
  
  @@map("qa_conversations")
  @@index([projectId])
  @@index([userId])
  @@index([createdAt])
}

// ============================================================
// MEETINGS & TRANSCRIPTION
// ============================================================

model Meeting {
  id        String @id @default(uuid())
  projectId String @map("project_id")
  
  title           String?
  durationSeconds Int?  @map("duration_seconds")
  fileUrl         String @map("file_url")  // Backblaze B2 URL
  
  // Transcription
  transcriptionStatus String @default("pending") @map("transcription_status")  // pending, processing, complete, failed
  transcriptText      String? @map("transcript_text") @db.Text
  
  // AI-extracted insights
  insights Json?  // { decisions: [], actionItems: [], risks: [], technicalDiscussions: [] }
  
  // Relations
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  @@map("meetings")
  @@index([projectId])
  @@index([transcriptionStatus])
}

// ============================================================
// TASK BOARD (Trello-style)
// ============================================================

model Board {
  id        String @id @default(uuid())
  projectId String @map("project_id")
  
  name String @default("Onboarding")
  
  // Relations
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  columns Column[]
  
  createdAt DateTime @default(now()) @map("created_at")
  
  @@map("boards")
  @@index([projectId])
}

model Column {
  id      String @id @default(uuid())
  boardId String @map("board_id")
  
  name     String
  position Int  // Order: 0, 1, 2...
  
  // Relations
  board Board @relation(fields: [boardId], references: [id], onDelete: Cascade)
  cards Card[]
  
  createdAt DateTime @default(now()) @map("created_at")
  
  @@map("columns")
  @@index([boardId])
}

model Card {
  id       String @id @default(uuid())
  columnId String @map("column_id")
  
  title       String
  description String?
  position    Int  // Order within column
  
  // Links
  linkedFiles  String[]  @map("linked_files")  // File paths
  linkedQaIds  String[]  @map("linked_qa_ids")  // QAConversation IDs
  
  // Assignment
  assignedToId String?   @map("assigned_to_id")
  assignedTo   User?     @relation("AssignedCards", fields: [assignedToId], references: [id], onDelete: SetNull)
  
  // Time tracking
  timeSpentMinutes Int @default(0) @map("time_spent_minutes")
  
  // Relations
  column Column @relation(fields: [columnId], references: [id], onDelete: Cascade)
  
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  @@map("cards")
  @@index([columnId])
  @@index([assignedToId])
}

// ============================================================
// BILLING & SUBSCRIPTIONS
// ============================================================

model Subscription {
  id     String @id @default(uuid())
  userId String @map("user_id")
  
  // Stripe data
  stripeCustomerId     String  @unique @map("stripe_customer_id")
  stripeSubscriptionId String? @map("stripe_subscription_id")
  
  tier   String  @default("free")  // free, pro, team, enterprise
  status String  @default("active") // active, canceled, past_due, trialing
  
  currentPeriodEnd DateTime? @map("current_period_end")
  cancelAtPeriodEnd Boolean @default(false) @map("cancel_at_period_end")
  
  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  @@map("subscriptions")
  @@index([userId])
  @@index([status])
}

model UsageLog {
  id        String @id @default(uuid())
  userId    String @map("user_id")
  projectId String? @map("project_id")
  
  action      String  // index, qa, meeting, export
  costCredits Int     @map("cost_credits")  // Credits consumed
  metadata    Json?   // { filesCount, tokensUsed, etc. }
  
  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  createdAt DateTime @default(now()) @map("created_at")
  
  @@map("usage_logs")
  @@index([userId])
  @@index([createdAt])
}
```

---

## 🔌 Complete tRPC API Specification

```typescript
// src/server/routers/index.ts

import { router } from '../trpc';
import { authRouter } from './auth';
import { projectRouter } from './project';
import { qaRouter } from './qa';
import { meetingRouter } from './meeting';
import { boardRouter } from './board';
import { billingRouter } from './billing';

export const appRouter = router({
  auth: authRouter,
  project: projectRouter,
  qa: qaRouter,
  meeting: meetingRouter,
  board: boardRouter,
  billing: billingRouter,
});

export type AppRouter = typeof appRouter;
```

---

### Auth Router

```typescript
// src/server/routers/auth.ts

import { router, publicProcedure, protectedProcedure } from '../trpc';
import { z } from 'zod';

export const authRouter = router({
  // Get current session
  getSession: publicProcedure
    .query(async ({ ctx }) => {
      return ctx.user;  // null if not logged in
    }),
  
  // GitHub OAuth (handled by Supabase, this just creates user record)
  handleOAuthCallback: publicProcedure
    .input(z.object({
      code: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Exchange code for token (via Supabase)
      const { data: { session } } = await ctx.supabase.auth.exchangeCodeForSession(input.code);
      
      // Create or update user
      const user = await ctx.prisma.user.upsert({
        where: { email: session.user.email },
        create: {
          email: session.user.email,
          name: session.user.user_metadata.name,
          avatarUrl: session.user.user_metadata.avatar_url,
          githubId: session.user.user_metadata.provider_id,
          githubUsername: session.user.user_metadata.user_name,
        },
        update: {
          githubToken: session.provider_token,  // Encrypt in real app
        },
      });
      
      return { user, session };
    }),
  
  // Logout
  logout: protectedProcedure
    .mutation(async ({ ctx }) => {
      await ctx.supabase.auth.signOut();
      return { success: true };
    }),
});
```

---

### Project Router

```typescript
// src/server/routers/project.ts

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { indexingQueue } from '../queues';

export const projectRouter = router({
  // List all projects for current user
  list: protectedProcedure
    .query(async ({ ctx }) => {
      const projects = await ctx.prisma.project.findMany({
        where: {
          members: {
            some: { userId: ctx.user.id },
          },
        },
        include: {
          members: {
            include: { user: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });
      
      return projects;
    }),
  
  // Create new project
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      githubUrl: z.string().url().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Check user has enough credits
      if (ctx.user.credits < 100) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Insufficient credits. Please upgrade your plan.',
        });
      }
      
      // Create project
      const project = await ctx.prisma.project.create({
        data: {
          name: input.name,
          githubUrl: input.githubUrl,
          members: {
            create: {
              userId: ctx.user.id,
              role: 'owner',
            },
          },
        },
      });
      
      return project;
    }),
  
  // Connect GitHub repo
  connectGitHub: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      repoUrl: z.string().url(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify user is project member
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: {
            some: { userId: ctx.user.id },
          },
        },
      });
      
      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      
      // Update project
      const updated = await ctx.prisma.project.update({
        where: { id: input.projectId },
        data: {
          githubUrl: input.repoUrl,
          status: 'pending',
        },
      });
      
      return updated;
    }),
  
  // Start indexing
  startIndexing: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify ownership
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: {
            some: { userId: ctx.user.id },
          },
        },
      });
      
      if (!project || !project.githubUrl) {
        throw new TRPCError({ code: 'BAD_REQUEST' });
      }
      
      // Deduct credits (100 for indexing)
      await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: { credits: { decrement: 100 } },
      });
      
      // Log usage
      await ctx.prisma.usageLog.create({
        data: {
          userId: ctx.user.id,
          projectId: project.id,
          action: 'index',
          costCredits: 100,
        },
      });
      
      // Update status
      await ctx.prisma.project.update({
        where: { id: input.projectId },
        data: { status: 'indexing' },
      });
      
      // Enqueue background job
      await indexingQueue.add('index-repo', {
        projectId: project.id,
        repoUrl: project.githubUrl,
        userId: ctx.user.id,
      });
      
      return { success: true, message: 'Indexing started' };
    }),
  
  // Get project details
  get: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: {
            some: { userId: ctx.user.id },
          },
        },
        include: {
          files: {
            orderBy: { filePath: 'asc' },
          },
          commits: {
            orderBy: { committedAt: 'desc' },
            take: 50,
          },
          members: {
            include: { user: true },
          },
        },
      });
      
      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      
      return project;
    }),
  
  // Get architecture graph
  getArchitecture: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: {
            some: { userId: ctx.user.id },
          },
        },
        select: {
          architectureJson: true,
          files: {
            select: {
              id: true,
              filePath: true,
              riskLevel: true,
              dependentsCount: true,
            },
          },
        },
      });
      
      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      
      return {
        graph: project.architectureJson,
        files: project.files,
      };
    }),
  
  // Delete project
  delete: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify ownership
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: {
            some: {
              userId: ctx.user.id,
              role: 'owner',
            },
          },
        },
      });
      
      if (!project) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      
      // Delete from Qdrant (vector DB)
      await ctx.qdrant.deleteCollection(`project_${project.id}`);
      
      // Delete from PostgreSQL (cascade will delete all related data)
      await ctx.prisma.project.delete({
        where: { id: input.projectId },
      });
      
      return { success: true };
    }),
});
```

---

### Q&A Router

```typescript
// src/server/routers/qa.ts

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { searchCode } from '../services/search';
import { generateAnswer } from '../services/llm';

export const qaRouter = router({
  // Ask question (streaming response)
  ask: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      question: z.string().min(1).max(500),
    }))
    .subscription(async ({ input, ctx }) => {
      // Verify access
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: {
            some: { userId: ctx.user.id },
          },
        },
      });
      
      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      
      // Check project is indexed
      if (project.status !== 'complete') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Project not yet indexed',
        });
      }
      
      return observable<{ chunk: string; done: boolean }>((emit) => {
        (async () => {
          const startTime = Date.now();
          
          // 1. Search for relevant code
          const searchResults = await searchCode(input.question, input.projectId);
          
          // 2. Stream LLM response
          const stream = await generateAnswer(input.question, searchResults);
          
          let fullAnswer = '';
          
          for await (const chunk of stream) {
            fullAnswer += chunk;
            emit.next({ chunk, done: false });
          }
          
          // 3. Save conversation
          const responseTime = Date.now() - startTime;
          
          await ctx.prisma.qAConversation.create({
            data: {
              projectId: input.projectId,
              userId: ctx.user.id,
              question: input.question,
              answer: fullAnswer,
              contextFiles: searchResults,
              responseTimeMs: responseTime,
            },
          });
          
          emit.next({ chunk: '', done: true });
          emit.complete();
        })();
      });
    }),
  
  // Get Q&A history
  getHistory: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input, ctx }) => {
      const conversations = await ctx.prisma.qAConversation.findMany({
        where: {
          projectId: input.projectId,
          userId: ctx.user.id,
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
      });
      
      return conversations;
    }),
});
```

---

### Meeting Router

```typescript
// src/server/routers/meeting.ts

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { uploadToB2 } from '../services/storage';
import { transcriptionQueue } from '../queues';

export const meetingRouter = router({
  // Upload meeting file
  upload: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      title: z.string().optional(),
      fileUrl: z.string().url(),  // Pre-signed upload URL or base64
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify access
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: {
            some: { userId: ctx.user.id },
          },
        },
      });
      
      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      
      // Check credits (10 credits per meeting)
      if (ctx.user.credits < 10) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Insufficient credits',
        });
      }
      
      // Upload to Backblaze B2
      const b2Url = await uploadToB2(input.fileUrl, `${ctx.user.id}/${project.id}`);
      
      // Create meeting record
      const meeting = await ctx.prisma.meeting.create({
        data: {
          projectId: input.projectId,
          title: input.title || 'Untitled Meeting',
          fileUrl: b2Url,
          transcriptionStatus: 'pending',
        },
      });
      
      // Deduct credits
      await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: { credits: { decrement: 10 } },
      });
      
      // Enqueue transcription job
      await transcriptionQueue.add('transcribe', {
        meetingId: meeting.id,
        fileUrl: b2Url,
        projectId: project.id,
      });
      
      return meeting;
    }),
  
  // List meetings
  list: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      const meetings = await ctx.prisma.meeting.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: 'desc' },
      });
      
      return meetings;
    }),
  
  // Get meeting details
  get: protectedProcedure
    .input(z.object({
      meetingId: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      const meeting = await ctx.prisma.meeting.findUnique({
        where: { id: input.meetingId },
        include: {
          project: {
            include: {
              members: true,
            },
          },
        },
      });
      
      if (!meeting) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      
      // Verify access via project membership
      const isMember = meeting.project.members.some(m => m.userId === ctx.user.id);
      if (!isMember) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      
      return meeting;
    }),
});
```

---

### Board Router (Task Management)

```typescript
// src/server/routers/board.ts

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const boardRouter = router({
  // Get board for project
  get: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      // Find or create board
      let board = await ctx.prisma.board.findFirst({
        where: { projectId: input.projectId },
        include: {
          columns: {
            include: {
              cards: {
                include: {
                  assignedTo: true,
                },
                orderBy: { position: 'asc' },
              },
            },
            orderBy: { position: 'asc' },
          },
        },
      });
      
      if (!board) {
        // Create default board with columns
        board = await ctx.prisma.board.create({
          data: {
            projectId: input.projectId,
            columns: {
              create: [
                { name: '📝 To Learn', position: 0 },
                { name: '🔍 Exploring', position: 1 },
                { name: '✅ Understood', position: 2 },
                { name: '🛠️ Ready to Modify', position: 3 },
              ],
            },
          },
          include: {
            columns: {
              include: {
                cards: true,
              },
              orderBy: { position: 'asc' },
            },
          },
        });
      }
      
      return board;
    }),
  
  // Create card
  createCard: protectedProcedure
    .input(z.object({
      columnId: z.string().uuid(),
      title: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      linkedFiles: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Get max position in column
      const maxCard = await ctx.prisma.card.findFirst({
        where: { columnId: input.columnId },
        orderBy: { position: 'desc' },
      });
      
      const card = await ctx.prisma.card.create({
        data: {
          columnId: input.columnId,
          title: input.title,
          description: input.description,
          linkedFiles: input.linkedFiles || [],
          position: (maxCard?.position || 0) + 1,
        },
        include: {
          assignedTo: true,
        },
      });
      
      return card;
    }),
  
  // Move card
  moveCard: protectedProcedure
    .input(z.object({
      cardId: z.string().uuid(),
      columnId: z.string().uuid(),
      position: z.number().int().min(0),
    }))
    .mutation(async ({ input, ctx }) => {
      const card = await ctx.prisma.card.update({
        where: { id: input.cardId },
        data: {
          columnId: input.columnId,
          position: input.position,
        },
      });
      
      return card;
    }),
  
  // Update card
  updateCard: protectedProcedure
    .input(z.object({
      cardId: z.string().uuid(),
      title: z.string().optional(),
      description: z.string().optional(),
      linkedFiles: z.array(z.string()).optional(),
      assignedToId: z.string().uuid().optional(),
      timeSpentMinutes: z.number().int().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { cardId, ...data } = input;
      
      const card = await ctx.prisma.card.update({
        where: { id: cardId },
        data,
        include: {
          assignedTo: true,
        },
      });
      
      return card;
    }),
  
  // Delete card
  deleteCard: protectedProcedure
    .input(z.object({
      cardId: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.card.delete({
        where: { id: input.cardId },
      });
      
      return { success: true };
    }),
});
```

---

## 🛠️ Worker Implementation (Detailed)

### Indexing Worker

```typescript
// src/workers/indexing.worker.ts

import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import { simpleGit } from 'simple-git';
import { parseFile } from '../services/parser';
import { generateEmbeddings } from '../services/embeddings';
import { analyzeDependencies } from '../services/analyzer';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();
const qdrant = new QdrantClient({ url: process.env.QDRANT_URL });
const git = simpleGit();

interface IndexingJobData {
  projectId: string;
  repoUrl: string;
  userId: string;
}

const worker = new Worker<IndexingJobData>(
  'indexing',
  async (job: Job<IndexingJobData>) => {
    const { projectId, repoUrl, userId } = job.data;
    
    console.log(`[Indexing] Starting for project ${projectId}`);
    
    const tempDir = `/tmp/repo_${projectId}`;
    
    try {
      // 1. Clone repository
      await job.updateProgress(10);
      console.log('[Indexing] Cloning repo...');
      await git.clone(repoUrl, tempDir);
      
      // 2. Get file list
      await job.updateProgress(20);
      const files = await getAllFiles(tempDir);
      const supportedFiles = files.filter(f => isSupportedFile(f));
      
      await prisma.project.update({
        where: { id: projectId },
        data: { totalFiles: supportedFiles.length },
      });
      
      // 3. Parse files
      await job.updateProgress(30);
      const parsedFiles = [];
      
      for (let i = 0; i < supportedFiles.length; i++) {
        const filePath = supportedFiles[i];
        const relativePath = path.relative(tempDir, filePath);
        
        try {
          const parsed = await parseFile(filePath);
          parsedFiles.push({ ...parsed, path: relativePath });
          
          // Save to database
          await prisma.file.create({
            data: {
              projectId,
              filePath: relativePath,
              fileType: getFileType(filePath),
              linesOfCode: parsed.linesOfCode,
              functions: parsed.functions,
              classes: parsed.classes,
              imports: parsed.imports,
              exports: parsed.exports,
            },
          });
          
          await prisma.project.update({
            where: { id: projectId },
            data: { processedFiles: i + 1 },
          });
          
          await job.updateProgress(30 + (i / supportedFiles.length) * 40);
        } catch (err) {
          console.error(`[Indexing] Failed to parse ${relativePath}:`, err);
        }
      }
      
      // 4. Analyze dependencies
      await job.updateProgress(70);
      console.log('[Indexing] Analyzing dependencies...');
      const { graph, entryPoints, techStack } = await analyzeDependencies(parsedFiles);
      
      // Update file risk levels based on dependents
      for (const file of parsedFiles) {
        const dependents = graph.nodes.find(n => n.id === file.path)?.dependents || [];
        const riskLevel = 
          dependents.length >= 10 ? 'critical' :
          dependents.length >= 5 ? 'high' :
          dependents.length >= 2 ? 'medium' : 'low';
        
        await prisma.file.update({
          where: { id: file.id },
          data: {
            riskLevel,
            dependentsCount: dependents.length,
          },
        });
      }
      
      // 5. Generate embeddings
      await job.updateProgress(80);
      console.log('[Indexing] Generating embeddings...');
      
      // Create Qdrant collection
      await qdrant.createCollection(`project_${projectId}`, {
        vectors: {
          size: 768,
          distance: 'Cosine',
        },
      });
      
      // Batch embed files
      const BATCH_SIZE = 96;  // Cohere max
      for (let i = 0; i < parsedFiles.length; i += BATCH_SIZE) {
        const batch = parsedFiles.slice(i, i + BATCH_SIZE);
        const texts = batch.map(f => `File: ${f.path}\n${f.content}`);
        
        const embeddings = await generateEmbeddings(texts);
        
        // Store in Qdrant
        const points = batch.map((file, idx) => ({
          id: file.id,
          vector: embeddings[idx],
          payload: {
            projectId,
            filePath: file.path,
            content: file.content.slice(0, 5000),  // Store snippet
            type: 'file',
          },
        }));
        
        await qdrant.upsert(`project_${projectId}`, { points });
      }
      
      // 6. Save architecture JSON
      await job.updateProgress(90);
      await prisma.project.update({
        where: { id: projectId },
        data: {
          status: 'complete',
          architectureJson: graph,
          techStack,
          entryPoints,
          totalLines: parsedFiles.reduce((sum, f) => sum + f.linesOfCode, 0),
        },
      });
      
      // 7. Cleanup
      await job.updateProgress(100);
      await fs.rm(tempDir, { recursive: true });
      
      console.log(`[Indexing] Completed for project ${projectId}`);
      
    } catch (error) {
      console.error('[Indexing] Error:', error);
      
      await prisma.project.update({
        where: { id: projectId },
        data: {
          status: 'failed',
          indexingError: error.message,
        },
      });
      
      // Cleanup temp files
      try {
        await fs.rm(tempDir, { recursive: true });
      } catch {}
      
      throw error;
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    },
    concurrency: 2,  // Process 2 repos at once
  }
);

// Helper functions
async function getAllFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(entry => {
      const fullPath = path.join(dir, entry.name);
      return entry.isDirectory() ? getAllFiles(fullPath) : fullPath;
    })
  );
  return files.flat().filter(f => f);
}

function isSupportedFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rb', '.php'].includes(ext);
}

function getFileType(filePath: string): string {
  return path.extname(filePath).slice(1);  // Remove '.'
}

console.log('[Indexing Worker] Ready');
```

---

### Transcription Worker

```typescript
// src/workers/transcription.worker.ts

import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import { transcribeAudio } from '../services/groq';
import { extractInsights } from '../services/llm';
import { generateEmbeddings } from '../services/embeddings';

const prisma = new PrismaClient();
const qdrant = new QdrantClient({ url: process.env.QDRANT_URL });

interface TranscriptionJobData {
  meetingId: string;
  fileUrl: string;
  projectId: string;
}

const worker = new Worker<TranscriptionJobData>(
  'transcription',
  async (job: Job<TranscriptionJobData>) => {
    const { meetingId, fileUrl, projectId } = job.data;
    
    console.log(`[Transcription] Starting for meeting ${meetingId}`);
    
    try {
      // 1. Update status
      await prisma.meeting.update({
        where: { id: meetingId },
        data: { transcriptionStatus: 'processing' },
      });
      
      // 2. Transcribe audio
      await job.updateProgress(20);
      console.log('[Transcription] Calling Groq Whisper...');
      const segments = await transcribeAudio(fileUrl);
      
      const fullTranscript = segments.map(s => s.text).join(' ');
      
      // 3. Extract insights
      await job.updateProgress(50);
      console.log('[Transcription] Extracting insights...');
      const insights = await extractInsights(fullTranscript);
      
      // 4. Chunk transcript and embed
      await job.updateProgress(70);
      const chunks = chunkTranscript(segments, 500);  // 500 words per chunk
      
      const chunkTexts = chunks.map(c => c.text);
      const embeddings = await generateEmbeddings(chunkTexts);
      
      // 5. Store embeddings in Qdrant
      const points = chunks.map((chunk, idx) => ({
        id: `${meetingId}_chunk_${idx}`,
        vector: embeddings[idx],
        payload: {
          meetingId,
          projectId,
          text: chunk.text,
          timestampStart: chunk.start,
          timestampEnd: chunk.end,
        },
      }));
      
      await qdrant.upsert(`project_${projectId}`, { points });
      
      // 6. Save to database
      await job.updateProgress(90);
      await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          transcriptionStatus: 'complete',
          transcriptText: fullTranscript,
          insights,
          durationSeconds: segments[segments.length - 1]?.end || 0,
        },
      });
      
      console.log(`[Transcription] Completed for meeting ${meetingId}`);
      
    } catch (error) {
      console.error('[Transcription] Error:', error);
      
      await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          transcriptionStatus: 'failed',
        },
      });
      
      throw error;
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    },
    concurrency: 3,  // Process 3 meetings at once
  }
);

function chunkTranscript(segments: any[], maxWords: number) {
  const chunks = [];
  let currentChunk = { text: '', start: 0, end: 0 };
  let wordCount = 0;
  
  for (const segment of segments) {
    const words = segment.text.split(' ').length;
    
    if (wordCount + words > maxWords && currentChunk.text) {
      chunks.push(currentChunk);
      currentChunk = { text: '', start: segment.start, end: segment.end };
      wordCount = 0;
    }
    
    if (!currentChunk.text) {
      currentChunk.start = segment.start;
    }
    
    currentChunk.text += ' ' + segment.text;
    currentChunk.end = segment.end;
    wordCount += words;
  }
  
  if (currentChunk.text) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

console.log('[Transcription Worker] Ready');
```

---

## 🎨 Frontend Component Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── callback/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # Project list
│   │   └── project/
│   │       └── [id]/
│   │           ├── page.tsx          # Overview
│   │           ├── architecture/
│   │           │   └── page.tsx      # Graph viz
│   │           ├── qa/
│   │           │   └── page.tsx      # Q&A interface
│   │           ├── board/
│   │           │   └── page.tsx      # Kanban board
│   │           └── meetings/
│   │               ├── page.tsx
│   │               └── [meetingId]/
│   │                   └── page.tsx
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                           # shadcn components
│   ├── ArchitectureGraph.tsx
│   ├── QAChat.tsx
│   ├── KanbanBoard.tsx
│   ├── FileExplorer.tsx
│   └── MeetingPlayer.tsx
├── lib/
│   ├── trpc.ts                       # tRPC client
│   ├── supabase.ts                   # Supabase client
│   └── utils.ts
└── styles/
    └── globals.css
```

---

## 🔧 Environment Variables

```bash
# .env

# Database
DATABASE_URL="postgresql://user:pass@host:5432/db"

# Redis
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_URL="redis://localhost:6379"

# Qdrant
QDRANT_URL="https://xyz.cloud.qdrant.io"
QDRANT_API_KEY="***"

# Supabase (Auth + Postgres)
SUPABASE_URL="https://xyz.supabase.co"
SUPABASE_ANON_KEY="***"
SUPABASE_SERVICE_KEY="***"

# GitHub OAuth
GITHUB_CLIENT_ID="***"
GITHUB_CLIENT_SECRET="***"

# Groq API
GROQ_API_KEY="***"

# Cohere API
COHERE_API_KEY="***"

# Backblaze B2
B2_KEY_ID="***"
B2_APPLICATION_KEY="***"
B2_BUCKET_NAME="legacylens-meetings"

# Stripe
STRIPE_SECRET_KEY="sk_live_***"
STRIPE_WEBHOOK_SECRET="whsec_***"
STRIPE_PUBLISHABLE_KEY="pk_live_***"

# Sentry
SENTRY_DSN="https://***@sentry.io/***"

# App config
NODE_ENV="production"
PORT="8080"
FRONTEND_URL="https://legacylens.com"
```

---

**NEXT:** Ready to create the complete `RULES.txt` for Cursor?

