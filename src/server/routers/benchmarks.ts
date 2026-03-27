// ============================================================
// LegacyLens — Benchmarks Router
// Create suites/cases and run them to evaluate models/pipeline
// ============================================================

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, logger } from '../trpc.js';
import { runBenchmarkSuite } from '../services/benchmarks.js';

export const benchmarksRouter = router({
  listSuites: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const isMember = await ctx.prisma.userToProject.findFirst({
        where: { projectId: input.projectId, userId: ctx.user.id },
      });
      if (!isMember) throw new TRPCError({ code: 'FORBIDDEN' });

      return ctx.prisma.benchmarkSuite.findMany({
        where: { projectId: input.projectId },
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: { select: { cases: true, runs: true } },
        },
      });
    }),

  getSuite: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), suiteId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const isMember = await ctx.prisma.userToProject.findFirst({
        where: { projectId: input.projectId, userId: ctx.user.id },
      });
      if (!isMember) throw new TRPCError({ code: 'FORBIDDEN' });

      const suite = await ctx.prisma.benchmarkSuite.findFirst({
        where: { id: input.suiteId, projectId: input.projectId },
        include: {
          cases: { orderBy: { createdAt: 'asc' } },
          runs: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      });
      if (!suite) throw new TRPCError({ code: 'NOT_FOUND' });
      return suite;
    }),

  createSuite: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        name: z.string().min(1).max(120),
        description: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const isMember = await ctx.prisma.userToProject.findFirst({
        where: { projectId: input.projectId, userId: ctx.user.id, role: { in: ['owner', 'admin'] } },
      });
      if (!isMember) throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owners/admins can create suites' });

      return ctx.prisma.benchmarkSuite.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          description: input.description ?? null,
        },
      });
    }),

  addCase: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        suiteId: z.string().uuid(),
        name: z.string().min(1).max(120),
        prompt: z.string().min(1).max(8000),
        expectedKeywords: z.array(z.string()).default([]),
        expectedFilePaths: z.array(z.string()).default([]),
        minScore: z.number().min(0).max(1).default(0.6),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const suite = await ctx.prisma.benchmarkSuite.findFirst({
        where: { id: input.suiteId, projectId: input.projectId },
      });
      if (!suite) throw new TRPCError({ code: 'NOT_FOUND' });

      const isMember = await ctx.prisma.userToProject.findFirst({
        where: { projectId: input.projectId, userId: ctx.user.id, role: { in: ['owner', 'admin'] } },
      });
      if (!isMember) throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owners/admins can add cases' });

      return ctx.prisma.benchmarkCase.create({
        data: {
          suiteId: input.suiteId,
          name: input.name,
          prompt: input.prompt,
          expectedKeywords: input.expectedKeywords,
          expectedFilePaths: input.expectedFilePaths,
          minScore: input.minScore,
        },
      });
    }),

  deleteCase: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), caseId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // Verify case belongs to project
      const c = await ctx.prisma.benchmarkCase.findFirst({
        where: { id: input.caseId },
        include: { suite: { select: { projectId: true } } },
      });
      if (!c || c.suite.projectId !== input.projectId) throw new TRPCError({ code: 'NOT_FOUND' });

      const isMember = await ctx.prisma.userToProject.findFirst({
        where: { projectId: input.projectId, userId: ctx.user.id, role: { in: ['owner', 'admin'] } },
      });
      if (!isMember) throw new TRPCError({ code: 'FORBIDDEN' });

      await ctx.prisma.benchmarkCase.delete({ where: { id: input.caseId } });
      return { success: true };
    }),

  listRuns: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), suiteId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const isMember = await ctx.prisma.userToProject.findFirst({
        where: { projectId: input.projectId, userId: ctx.user.id },
      });
      if (!isMember) throw new TRPCError({ code: 'FORBIDDEN' });

      return ctx.prisma.benchmarkRun.findMany({
        where: { suiteId: input.suiteId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      });
    }),

  getRun: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), runId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const isMember = await ctx.prisma.userToProject.findFirst({
        where: { projectId: input.projectId, userId: ctx.user.id },
      });
      if (!isMember) throw new TRPCError({ code: 'FORBIDDEN' });

      const run = await ctx.prisma.benchmarkRun.findFirst({
        where: { id: input.runId },
        include: {
          suite: true,
          results: {
            include: { case: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      if (!run || run.suite.projectId !== input.projectId) throw new TRPCError({ code: 'NOT_FOUND' });
      return run;
    }),

  runSuite: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        suiteId: z.string().uuid(),
        modelName: z.string().optional(),
        temperature: z.number().min(0).max(2).optional(),
        maxTokens: z.number().min(1).max(8000).optional(),
        aiTestMode: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const isMember = await ctx.prisma.userToProject.findFirst({
        where: { projectId: input.projectId, userId: ctx.user.id },
      });
      if (!isMember) throw new TRPCError({ code: 'FORBIDDEN' });

      const suite = await ctx.prisma.benchmarkSuite.findFirst({
        where: { id: input.suiteId, projectId: input.projectId },
      });
      if (!suite) throw new TRPCError({ code: 'NOT_FOUND' });

      // Run synchronously for MVP (later: queue with BullMQ)
      try {
        const run = await runBenchmarkSuite(ctx.prisma, input.suiteId, ctx.user.id, {
          modelName: input.modelName,
          temperature: input.temperature,
          maxTokens: input.maxTokens,
          aiTestMode: input.aiTestMode,
        });
        return run;
      } catch (err) {
        logger.error({ err, suiteId: input.suiteId }, 'Benchmark run failed');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err instanceof Error ? err.message : 'Benchmark run failed',
        });
      }
    }),
});

