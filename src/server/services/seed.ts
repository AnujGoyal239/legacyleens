// ============================================================
// LegacyLens — SeedService (Demo Repos)
// Pre-loads 3 famous OSS repos for VibeCon demo
// ============================================================

import { PrismaClient } from '@prisma/client';
import IORedis from 'ioredis';
import { logger } from '../trpc.js';
import { indexingQueue } from '../queues/index.js';
import { generateAnswer } from './llm.js';

const prisma = new PrismaClient();

export const DEMO_REPOS = [
  {
    githubUrl: 'https://github.com/django/django',
    name: 'Django',
    description: 'The web framework for perfectionists with deadlines.',
    language: 'Python',
  },
  {
    githubUrl: 'https://github.com/vercel/next.js',
    name: 'Next.js',
    description: 'The React Framework for the Web.',
    language: 'TypeScript',
  },
  {
    githubUrl: 'https://github.com/chatwoot/chatwoot',
    name: 'Chatwoot',
    description: 'Open-source customer engagement platform.',
    language: 'Ruby',
  },
] as const;

// Demo user email — shared account visible to all authenticated users
const DEMO_USER_EMAIL = 'demo@legacylens.app';

async function getOrCreateDemoUser() {
  let demoUser = await prisma.user.findUnique({ where: { email: DEMO_USER_EMAIL } });
  if (!demoUser) {
    demoUser = await prisma.user.create({
      data: {
        email: DEMO_USER_EMAIL,
        name: 'LegacyLens Demo',
        credits: 999999,
        subscriptionTier: 'pro',
      },
    });
    logger.info({ userId: demoUser.id }, '[Seed] Demo user created');
  }
  return demoUser;
}

async function seedBoardCards(projectId: string, boardId: string, topFilePaths: string[]) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: { columns: true },
  });
  if (!board) return;

  const colMap: Record<string, string> = {};
  for (const col of board.columns) {
    colMap[col.name] = col.id;
  }

  const toLearnId = colMap['To Learn'];
  const exploringId = colMap['Exploring'];
  const understoodId = colMap['Understood'];
  const readyId = colMap['Ready to Modify'];

  if (!toLearnId || !exploringId || !understoodId || !readyId) return;

  const safeFiles = topFilePaths.slice(0, 8);

  const cards = [
    // To Learn (3)
    { columnId: toLearnId, title: 'Read the README and understand the project goals', linkedFiles: safeFiles.slice(0, 1), position: 0 },
    { columnId: toLearnId, title: 'Trace the main entry point and startup sequence', linkedFiles: safeFiles.slice(0, 2), position: 1 },
    { columnId: toLearnId, title: 'Understand the folder structure and module boundaries', linkedFiles: safeFiles.slice(0, 3), position: 2 },
    // Exploring (2)
    { columnId: exploringId, title: 'Explore the authentication and session handling', linkedFiles: safeFiles.slice(1, 3), position: 0 },
    { columnId: exploringId, title: 'Understand the database models and relationships', linkedFiles: safeFiles.slice(2, 4), position: 1 },
    // Understood (2)
    { columnId: understoodId, title: 'Core request/response lifecycle', linkedFiles: safeFiles.slice(0, 2), position: 0 },
    { columnId: understoodId, title: 'Error handling and logging patterns', linkedFiles: safeFiles.slice(3, 5), position: 1 },
    // Ready to Modify (1)
    { columnId: readyId, title: 'Add a new utility function to a low-risk helper file', linkedFiles: safeFiles.slice(5, 7), position: 0 },
  ];

  for (const card of cards) {
    await prisma.card.create({
      data: {
        columnId: card.columnId,
        title: card.title,
        description: null,
        linkedFiles: card.linkedFiles,
        linkedQaIds: [],
        position: card.position,
      },
    });
  }

  logger.info({ projectId, count: cards.length }, '[Seed] Board cards seeded');
}

async function seedTeamMembers(projectId: string, demoUserId: string) {
  const syntheticMembers = [
    { name: 'Priya Sharma', email: `priya.sharma.demo.${projectId.slice(0, 8)}@legacylens.app`, role: 'Senior Engineer' },
    { name: 'Arjun Mehta', email: `arjun.mehta.demo.${projectId.slice(0, 8)}@legacylens.app`, role: 'Tech Lead' },
    { name: 'Sneha Patel', email: `sneha.patel.demo.${projectId.slice(0, 8)}@legacylens.app`, role: 'Backend Engineer' },
  ];

  for (const member of syntheticMembers) {
    let user = await prisma.user.findUnique({ where: { email: member.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: member.email,
          name: member.name,
          credits: 100,
          subscriptionTier: 'free',
        },
      });
    }

    const existing = await prisma.userToProject.findFirst({
      where: { userId: user.id, projectId },
    });
    if (!existing) {
      await prisma.userToProject.create({
        data: { userId: user.id, projectId, role: 'member' },
      });
    }
  }

  logger.info({ projectId }, '[Seed] Team members seeded');
}

async function seedChatMessages(projectId: string, demoUserId: string) {
  // Find or create team channel
  let channel = await prisma.chatChannel.findFirst({
    where: { projectId, type: 'team' },
  });
  if (!channel) {
    channel = await prisma.chatChannel.create({
      data: { projectId, type: 'team', name: 'general' },
    });
  }

  // Check if messages already exist
  const existing = await prisma.message.count({ where: { channelId: channel.id } });
  if (existing >= 3) return;

  const messages = [
    "Hey team, I noticed the auth middleware is doing a lot of heavy lifting — should we split it into separate concerns?",
    "Good catch! The session validation and permission checks could definitely be separate. Let's create a ticket for that refactor.",
    "Also, the database query in the user service is running N+1 queries on the profile endpoint. I'll fix that this sprint.",
    "Thanks for flagging that. Once you fix it, can you add a note to the onboarding guide? New devs keep hitting this.",
  ];

  for (let i = 0; i < messages.length; i++) {
    await prisma.message.create({
      data: {
        channelId: channel.id,
        userId: demoUserId,
        content: messages[i],
        mentions: [],
      },
    });
  }

  logger.info({ projectId }, '[Seed] Chat messages seeded');
}

async function seedMeeting(projectId: string) {
  const existing = await prisma.meeting.count({ where: { projectId } });
  if (existing > 0) return;

  const transcript = `[00:00] Priya: Alright, let's do a quick architecture walkthrough for the new team members.
[00:15] Arjun: Sure. So the entry point is src/server/index.ts — that's where Fastify boots up and registers all the tRPC routers.
[00:30] Priya: Right. And the most critical file is probably src/server/routers/project.ts — it handles all project creation, indexing, and the getArchitecture endpoint.
[01:00] Sneha: What about the worker? I see there's a separate indexing.worker.ts file.
[01:15] Arjun: Yes, that's the BullMQ worker. It runs separately and processes the indexing jobs. It clones the repo, parses files, generates embeddings, and stores everything in PostgreSQL.
[01:45] Priya: The embeddings go into pgvector via the search service. That's what powers the Q&A RAG pipeline.
[02:00] Sneha: Got it. So the flow is: user creates project → indexing job queued → worker clones and parses → embeddings stored → Q&A works.
[02:20] Arjun: Exactly. The safe files to start with are anything in src/lib/ and src/components/ui/ — low dependency count, easy to understand.
[02:45] Priya: Avoid touching src/server/services/analyzer.ts until you understand the dependency graph logic. It's complex.
[03:00] Sneha: Noted. I'll start with the UI components and work my way in.`;

  await prisma.meeting.create({
    data: {
      projectId,
      title: 'Architecture Walkthrough — New Team Onboarding',
      durationSeconds: 185,
      transcriptionStatus: 'complete',
      transcriptText: transcript,
      source: 'upload',
      insights: {
        decisions: [
          'Split auth middleware into separate session validation and permission check concerns',
          'Fix N+1 query in user service profile endpoint this sprint',
          'Update onboarding guide after N+1 fix',
        ],
        actionItems: [
          'Create ticket for auth middleware refactor',
          'Fix N+1 query in user service',
          'Add note to onboarding guide about the N+1 fix',
          'New devs to start with src/lib/ and src/components/ui/',
        ],
        risks: [
          'src/server/services/analyzer.ts is complex — avoid touching without full understanding',
          'Auth middleware has too many responsibilities — risk of regression during refactor',
        ],
        technicalDiscussions: [
          {
            topic: 'Entry point and server startup',
            summary: 'src/server/index.ts boots Fastify and registers all tRPC routers',
          },
          {
            topic: 'Indexing pipeline',
            summary: 'BullMQ worker in indexing.worker.ts clones repo, parses files, generates embeddings via pgvector',
          },
          {
            topic: 'Safe files for new developers',
            summary: 'src/lib/ and src/components/ui/ have low dependency counts and are safe to start with',
          },
        ],
      },
    },
  });

  logger.info({ projectId }, '[Seed] Demo meeting seeded');
}

async function cacheQAAnswers(projectId: string, redis: IORedis) {
  const questions = [
    'How does the overall architecture work?',
    'What are the main entry points of this application?',
    'Which files are the most critical and why?',
    'How does the authentication flow work?',
    'What is the data flow from a user request to the database?',
  ];

  for (let i = 0; i < questions.length; i++) {
    const key = `demo:qa:${projectId}:${i}`;
    const existing = await redis.get(key);
    if (existing) continue;

    try {
      const result = await generateAnswer(questions[i], []);
      await redis.set(key, JSON.stringify({ question: questions[i], answer: result.text }));
      logger.info({ projectId, questionIndex: i }, '[Seed] Q&A answer cached');
    } catch (err) {
      logger.warn({ projectId, questionIndex: i, err }, '[Seed] Failed to cache Q&A answer');
    }
  }
}

async function seedDemoRepo(
  repo: typeof DEMO_REPOS[number],
  demoUserId: string,
  redis: IORedis
) {
  logger.info({ repo: repo.name }, '[Seed] Starting demo repo seed');

  // Check if already exists
  const existing = await prisma.project.findFirst({
    where: { githubUrl: repo.githubUrl, isDemo: true },
  });

  if (existing) {
    logger.info({ repo: repo.name, projectId: existing.id }, '[Seed] Demo repo already exists, skipping');
    return;
  }

  // Create project record
  const project = await prisma.project.create({
    data: {
      name: repo.name,
      githubUrl: repo.githubUrl,
      repoDescription: repo.description,
      repoLanguage: repo.language,
      repoOwner: repo.githubUrl.split('/')[3],
      repoName: repo.githubUrl.split('/')[4],
      repoVisibility: 'public',
      isDemo: true,
      status: 'pending',
      members: {
        create: { userId: demoUserId, role: 'owner' },
      },
    },
  });

  logger.info({ projectId: project.id, repo: repo.name }, '[Seed] Project record created');

  // Enqueue indexing job
  await indexingQueue.add('index-repo', {
    projectId: project.id,
    repoUrl: repo.githubUrl,
    userId: demoUserId,
  });

  logger.info({ projectId: project.id, repo: repo.name }, '[Seed] Indexing job enqueued');

  // Create board with columns
  const board = await prisma.board.create({
    data: {
      projectId: project.id,
      name: 'Onboarding',
      columns: {
        create: [
          { name: 'To Learn', position: 0 },
          { name: 'Exploring', position: 1 },
          { name: 'Understood', position: 2 },
          { name: 'Ready to Modify', position: 3 },
        ],
      },
    },
  });

  // Seed board cards with placeholder file paths (real paths populated after indexing)
  const placeholderFiles = [
    'README.md',
    'src/index.ts',
    'src/server/index.ts',
    'src/components/App.tsx',
    'package.json',
    'src/lib/utils.ts',
    'src/server/routers/index.ts',
    'src/server/services/llm.ts',
  ];
  await seedBoardCards(project.id, board.id, placeholderFiles);
  logger.info({ projectId: project.id }, '[Seed] Board cards seeded');

  // Seed team members
  await seedTeamMembers(project.id, demoUserId);
  logger.info({ projectId: project.id }, '[Seed] Team members seeded');

  // Seed chat messages
  await seedChatMessages(project.id, demoUserId);
  logger.info({ projectId: project.id }, '[Seed] Chat messages seeded');

  // Seed demo meeting
  await seedMeeting(project.id);
  logger.info({ projectId: project.id }, '[Seed] Meeting seeded');

  // Cache Q&A answers
  await cacheQAAnswers(project.id, redis);
  logger.info({ projectId: project.id }, '[Seed] Q&A answers cached');

  logger.info({ projectId: project.id, repo: repo.name }, '[Seed] Demo repo seed complete');
}

export async function run() {
  logger.info('[Seed] SeedService starting');

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const redis = new IORedis(redisUrl, { maxRetriesPerRequest: null });

  try {
    const demoUser = await getOrCreateDemoUser();

    for (const repo of DEMO_REPOS) {
      try {
        await seedDemoRepo(repo, demoUser.id, redis);
      } catch (err) {
        logger.error(
          { repo: repo.name, err: err instanceof Error ? err.message : String(err) },
          '[Seed] Failed to seed demo repo (continuing with next)'
        );
      }
    }

    logger.info('[Seed] SeedService complete');
  } catch (err) {
    logger.error({ err }, '[Seed] SeedService failed');
  } finally {
    await redis.quit();
    await prisma.$disconnect();
  }
}
