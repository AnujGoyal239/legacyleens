// ============================================================
// LegacyLens — Onboarding Guide Router
// ============================================================

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, logger } from '../trpc.js';
import { generateOnboardingGuide } from '../services/llm.js';

export const onboardingRouter = router({
  // Generate a new onboarding guide
  generateGuide: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: { some: { userId: ctx.user.id } },
        },
        select: {
          id: true,
          name: true,
          status: true,
          techStack: true,
          entryPoints: true,
          totalFiles: true,
          totalLines: true,
          files: {
            select: {
              filePath: true,
              fileType: true,
              linesOfCode: true,
              riskLevel: true,
              dependentsCount: true,
              dependenciesCount: true,
              isEntryPoint: true,
            },
            orderBy: { dependentsCount: 'desc' },
          },
        },
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      if (project.status !== 'complete') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Project must be fully indexed before generating an Onboarding Guide.',
        });
      }

      // Prepare context for LLM
      const topFiles = project.files.slice(0, 10).map((f) => ({
        filePath: f.filePath,
        dependentsCount: f.dependentsCount,
        riskLevel: f.riskLevel,
        linesOfCode: f.linesOfCode,
      }));

      const complexFiles = [...project.files]
        .sort((a, b) => b.linesOfCode - a.linesOfCode)
        .slice(0, 10)
        .map((f) => ({
          filePath: f.filePath,
          linesOfCode: f.linesOfCode,
        }));

      const guideContent = await generateOnboardingGuide({
        projectName: project.name,
        techStack: project.techStack,
        entryPoints: project.entryPoints,
        topFiles,
        complexFiles,
        totalFiles: project.totalFiles || project.files.length,
        totalLines: project.totalLines || 0,
      });

      // Get existing version count
      const existingCount = await (ctx.prisma as any).onboardingGuide.count({
        where: { projectId: input.projectId },
      });

      // Store the guide
      const guide = await (ctx.prisma as any).onboardingGuide.create({
        data: {
          projectId: input.projectId,
          content: { markdown: guideContent },
          version: existingCount + 1,
        },
      });

      logger.info({ projectId: input.projectId, guideId: guide.id }, 'Onboarding guide generated');
      return guide;
    }),

  // Get the latest guide for a project
  getGuide: protectedProcedure
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

      const guide = await (ctx.prisma as any).onboardingGuide.findFirst({
        where: { projectId: input.projectId },
        orderBy: { generatedAt: 'desc' },
      });

      return guide ?? null;
    }),
});
