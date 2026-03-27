// ============================================================
// LegacyLens — Q&A Router (RAG Pipeline)
// ============================================================

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, logger } from '../trpc.js';
import { searchCode } from '../services/search.js';
import { generateAnswer } from '../services/llm.js';
import IORedis from 'ioredis';
import { createHash } from 'crypto';

let _redis: IORedis | null = null;
function getRedis(): IORedis {
  if (!_redis) {
    _redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }
  return _redis;
}

export const qaRouter = router({
  // Ask a question about the codebase (returns full response)
  ask: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        question: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify access & project status
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: { some: { userId: ctx.user.id } },
        },
        select: {
          id: true,
          status: true,
          isDemo: true,
        },
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      if (project.status !== 'complete') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Project must be fully indexed before asking questions',
        });
      }

      // Check credits
      if (ctx.user.credits < 1) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Insufficient credits. Please upgrade your plan.',
        });
      }

      const startTime = Date.now();

      try {
        // Check Redis cache for demo repos
        if (project.isDemo) {
          try {
            const redis = getRedis();
            const questionHash = createHash('sha256').update(input.question.toLowerCase().trim()).digest('hex');
            const cacheKey = `qa:cache:${input.projectId}:${questionHash}`;
            const cached = await redis.get(cacheKey);
            if (cached) {
              const parsed = JSON.parse(cached) as { answer: string; contextFiles: unknown[] };
              logger.info({ projectId: input.projectId }, 'Q&A cache hit (demo repo)');
              // Save to conversation history
              const conversation = await ctx.prisma.qAConversation.create({
                data: {
                  projectId: input.projectId,
                  userId: ctx.user.id,
                  question: input.question,
                  answer: parsed.answer,
                  contextFiles: JSON.parse(JSON.stringify(parsed.contextFiles ?? [])),
                  responseTimeMs: 0,
                  tokenCount: 0,
                },
              });
              return {
                id: conversation.id,
                question: input.question,
                answer: parsed.answer,
                contextFiles: parsed.contextFiles ?? [],
                responseTimeMs: 0,
              };
            }
          } catch (cacheErr) {
            logger.warn({ cacheErr }, 'Redis cache check failed, proceeding without cache');
          }
        }

        // 1. Search for relevant code snippets (RAG retrieval via Qdrant)
        let searchResults = await searchCode(input.question, input.projectId);

        // 2. Fallback: if no vector results, pull files directly from DB
        if (searchResults.length === 0) {
          logger.info({ projectId: input.projectId }, 'No vector results, falling back to DB files');
          const dbFiles = await ctx.prisma.file.findMany({
            where: { projectId: input.projectId },
            orderBy: { dependentsCount: 'desc' },
            take: 10,
            select: { filePath: true, fileType: true, linesOfCode: true, functions: true, classes: true },
          });

          searchResults = dbFiles.map((f) => ({
            filePath: f.filePath,
            content: [
              `File: ${f.filePath} (${f.fileType}, ${f.linesOfCode} lines)`,
              f.functions ? `Functions: ${JSON.stringify(f.functions)}` : '',
              f.classes ? `Classes: ${JSON.stringify(f.classes)}` : '',
            ].filter(Boolean).join('\n'),
            score: 0.8,
            type: 'code' as const,
            metadata: {},
          }));
        }

        // 3. Generate answer using LLM with context
        const answer = await generateAnswer(input.question, searchResults);

        const responseTime = Date.now() - startTime;

        // Cache the answer in Redis (24h TTL)
        if (project.isDemo) {
          try {
            const redis = getRedis();
            const questionHash = createHash('sha256').update(input.question.toLowerCase().trim()).digest('hex');
            const cacheKey = `qa:cache:${input.projectId}:${questionHash}`;
            await redis.setex(cacheKey, 86400, JSON.stringify({ answer: answer.text, contextFiles: searchResults }));
          } catch (cacheErr) {
            logger.warn({ cacheErr }, 'Failed to cache Q&A answer in Redis');
          }
        }

        // 3. Save conversation & deduct credits
        const [conversation] = await ctx.prisma.$transaction([
          ctx.prisma.qAConversation.create({
            data: {
              projectId: input.projectId,
              userId: ctx.user.id,
              question: input.question,
              answer: answer.text,
              contextFiles: JSON.parse(JSON.stringify(searchResults)),
              responseTimeMs: responseTime,
              tokenCount: answer.tokenCount,
            },
          }),
          ctx.prisma.user.update({
            where: { id: ctx.user.id },
            data: { credits: { decrement: 1 } },
          }),
          ctx.prisma.usageLog.create({
            data: {
              userId: ctx.user.id,
              projectId: input.projectId,
              action: 'qa',
              costCredits: 1,
              metadata: { responseTimeMs: responseTime },
            },
          }),
        ]);

        logger.info(
          { projectId: input.projectId, responseTimeMs: responseTime },
          'Q&A completed'
        );

        return {
          id: conversation.id,
          question: input.question,
          answer: answer.text,
          contextFiles: searchResults,
          responseTimeMs: responseTime,
        };
      } catch (error) {
        logger.error({ error, projectId: input.projectId }, 'Q&A generation failed');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate answer. Please try again.',
        });
      }
    }),

  // Get Q&A history for a project
  getHistory: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const conversations = await ctx.prisma.qAConversation.findMany({
        where: {
          projectId: input.projectId,
          userId: ctx.user.id,
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        select: {
          id: true,
          question: true,
          answer: true,
          contextFiles: true,
          responseTimeMs: true,
          createdAt: true,
        },
      });

      let nextCursor: string | undefined;
      if (conversations.length > input.limit) {
        const nextItem = conversations.pop();
        nextCursor = nextItem?.id;
      }

      return {
        conversations,
        nextCursor,
      };
    }),

  // Get suggested questions for a project
  getSuggestions: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: { some: { userId: ctx.user.id } },
        },
        select: {
          name: true,
          repoDescription: true,
          techStack: true,
          repoLanguage: true,
          files: {
            orderBy: { dependentsCount: 'desc' },
            take: 5,
            select: { filePath: true, riskLevel: true, dependentsCount: true },
          },
        },
      });

      if (!project) return [];

      const topFile = project.files[0]?.filePath ?? 'the main module';
      const criticalFile = project.files.find((f) => f.riskLevel === 'critical')?.filePath ?? topFile;
      const lang = project.repoLanguage ?? 'the codebase';
      const techStack = project.techStack as { frameworks?: string[]; languages?: { name: string }[] } | null;
      const framework = techStack?.frameworks?.[0] ?? lang;

      const suggestions = [
        `How does the overall architecture of ${project.name} work?`,
        `What is the purpose of ${topFile} and why does it have so many dependents?`,
        `How does ${framework} handle routing and middleware in this project?`,
        `Which files are the most dangerous to modify and why?`,
        `Walk me through the main data flow from request to response in ${project.name}.`,
      ];

      if (criticalFile !== topFile) {
        suggestions[3] = `Why is ${criticalFile} considered a critical file?`;
      }

      return suggestions.slice(0, 5);
    }),
});
