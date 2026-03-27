// ============================================================
// LegacyLens — History Router (Commit "Why" Intelligence)
// ============================================================

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, logger } from '../trpc.js';
import { generateCommitWhy } from '../services/llm.js';

export const historyRouter = router({
  // Generate "Why" explanation for a single commit
  generateWhy: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        commitHash: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: { some: { userId: ctx.user.id } },
        },
        select: { id: true },
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      // Check cache
      const existing = await (ctx.prisma as any).commitInsight.findUnique({
        where: {
          projectId_commitHash: {
            projectId: input.projectId,
            commitHash: input.commitHash,
          },
        },
      });

      if (existing) {
        return existing;
      }

      // Get commit data
      const commit = await ctx.prisma.commit.findFirst({
        where: {
          projectId: input.projectId,
          commitHash: input.commitHash,
        },
      });

      if (!commit) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Commit not found' });
      }

      const why = await generateCommitWhy(
        commit.message,
        commit.filesChanged || []
      );

      if (!why) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate explanation',
        });
      }

      const insight = await (ctx.prisma as any).commitInsight.create({
        data: {
          projectId: input.projectId,
          commitHash: input.commitHash,
          why,
        },
      });

      logger.info({ projectId: input.projectId, commitHash: input.commitHash }, 'Commit Why generated');
      return insight;
    }),

  // Bulk generate "Why" for multiple commits
  generateAllWhy: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: { some: { userId: ctx.user.id } },
        },
        select: { id: true },
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      const commits = await ctx.prisma.commit.findMany({
        where: { projectId: input.projectId },
        orderBy: { committedAt: 'desc' },
        take: input.limit,
      });

      let generated = 0;
      for (const commit of commits) {
        // Skip if already generated
        const existing = await (ctx.prisma as any).commitInsight.findUnique({
          where: {
            projectId_commitHash: {
              projectId: input.projectId,
              commitHash: commit.commitHash,
            },
          },
        });

        if (existing) continue;

        try {
          const why = await generateCommitWhy(
            commit.message,
            commit.filesChanged || []
          );

          if (why) {
            await (ctx.prisma as any).commitInsight.create({
              data: {
                projectId: input.projectId,
                commitHash: commit.commitHash,
                why,
              },
            });
            generated++;
          }
        } catch (err) {
          logger.warn({ commitHash: commit.commitHash, err }, 'Failed to generate Why for commit');
        }
      }

      logger.info({ projectId: input.projectId, generated, total: commits.length }, 'Bulk Commit Why generated');
      return { generated, total: commits.length };
    }),

  // Get all cached insights for a project
  getInsights: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: { some: { userId: ctx.user.id } },
        },
        select: { id: true },
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      const insights = await (ctx.prisma as any).commitInsight.findMany({
        where: { projectId: input.projectId },
      });

      // Return as a map for easy lookup
      const insightMap: Record<string, string> = {};
      for (const insight of insights) {
        insightMap[insight.commitHash] = insight.why;
      }

      return { insights: insightMap };
    }),
});
