// ============================================================
// LegacyLens — Q&A Router (RAG Pipeline)
// ============================================================

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, logger } from '../trpc.js';
import { searchCode } from '../services/search.js';
import { generateAnswer } from '../services/llm.js';

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
          techStack: true,
          entryPoints: true,
          files: {
            where: { riskLevel: { in: ['high', 'critical'] } },
            select: { filePath: true },
            take: 5,
          },
        },
      });

      if (!project) return [];

      // Generate contextual suggestions
      const suggestions = [
        'How does the overall architecture work?',
        'What are the main entry points of this application?',
        'What technologies and frameworks are used?',
        'Which files are the most critical and why?',
        'How does error handling work in this codebase?',
      ];

      if (project.files.length > 0) {
        suggestions.push(
          `Why is ${project.files[0].filePath} considered a critical file?`
        );
      }

      return suggestions;
    }),
});
