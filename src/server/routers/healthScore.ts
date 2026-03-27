// ============================================================
// LegacyLens — Health Score Router
// ============================================================

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, logger } from '../trpc.js';
import { computeHealthScore } from '../services/healthScoreCompute.js';

export const healthScoreRouter = router({
  // Compute and store health score
  compute: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: { some: { userId: ctx.user.id } },
        },
        select: {
          id: true,
          status: true,
          entryPoints: true,
          files: {
            select: {
              filePath: true,
              fileType: true,
              linesOfCode: true,
              riskLevel: true,
              dependentsCount: true,
              dependenciesCount: true,
              isEntryPoint: true,
              functions: true,
              classes: true,
              imports: true,
            },
          },
        },
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      if (project.status !== 'complete') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Project must be fully indexed before computing Health Score.',
        });
      }

      const result = computeHealthScore(
        project.files as Parameters<typeof computeHealthScore>[0],
        project.entryPoints
      );

      // Upsert health score
      const score = await (ctx.prisma as any).codebaseHealthScore.upsert({
        where: { projectId: input.projectId },
        create: {
          projectId: input.projectId,
          overallScore: result.overallScore,
          docCoverageScore: result.docCoverageScore,
          criticalFileRiskScore: result.criticalFileRiskScore,
          complexityScore: result.complexityScore,
          onboardingReadiness: result.onboardingReadiness,
        },
        update: {
          overallScore: result.overallScore,
          docCoverageScore: result.docCoverageScore,
          criticalFileRiskScore: result.criticalFileRiskScore,
          complexityScore: result.complexityScore,
          onboardingReadiness: result.onboardingReadiness,
          computedAt: new Date(),
        },
      });

      logger.info({ projectId: input.projectId, score: result.overallScore }, 'Health score computed');
      return score;
    }),

  // Get cached health score
  get: protectedProcedure
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

      const score = await (ctx.prisma as any).codebaseHealthScore.findUnique({
        where: { projectId: input.projectId },
      });

      return score ?? null;
    }),
});
