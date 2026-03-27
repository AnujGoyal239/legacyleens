// ============================================================
// LegacyLens — Insights Router (Security, Test coverage, Health, Refactor, Fix it)
// ============================================================

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { scanSecrets, getVulnerableDeps, getLicenseList } from '../services/security.js';
import { getTestsForFile, getFilesWithNoTests } from '../services/testCoverage.js';
import { getHealthDashboard } from '../services/healthDashboard.js';
import { findReferences, suggestExtract, suggestSplit, suggestSharedHelper } from '../services/refactorSuggestions.js';
import { suggestFixes, createPrDraft } from '../services/fixIt.js';

export const insightsRouter = router({
  // --- Security & compliance ---
  scanSecrets: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, members: { some: { userId: ctx.user.id } } },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      return scanSecrets(input.projectId);
    }),

  getVulnerableDeps: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, members: { some: { userId: ctx.user.id } } },
        select: { githubUrl: true, defaultBranch: true, githubPat: true },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      return getVulnerableDeps(
        input.projectId,
        project.githubUrl,
        project.defaultBranch,
        project.githubPat
      );
    }),

  getLicenseList: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, members: { some: { userId: ctx.user.id } } },
        select: { githubUrl: true, defaultBranch: true, githubPat: true },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      return getLicenseList(
        input.projectId,
        project.githubUrl,
        project.defaultBranch,
        project.githubPat
      );
    }),

  // --- Test coverage & gaps ---
  getTestsForFile: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), filePath: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, members: { some: { userId: ctx.user.id } } },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      return getTestsForFile(input.projectId, input.filePath);
    }),

  getFilesWithNoTests: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, members: { some: { userId: ctx.user.id } } },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      return getFilesWithNoTests(input.projectId);
    }),

  // --- Codebase health ---
  getHealthDashboard: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, members: { some: { userId: ctx.user.id } } },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      const noTests = await getFilesWithNoTests(input.projectId);
      const vuln = await getVulnerableDeps(
        input.projectId,
        project.githubUrl,
        project.defaultBranch,
        project.githubPat
      ).catch(() => ({ audit: null }));
      const vulnCount = vuln.audit?.vulnerabilities ?? 0;
      return getHealthDashboard(input.projectId, {
        vulnerableDepsCount: vulnCount,
        filesWithNoTestsCount: noTests.length,
      });
    }),

  // --- Refactor suggestions ---
  findReferences: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), filePath: z.string(), symbol: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, members: { some: { userId: ctx.user.id } } },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      return findReferences(input.projectId, input.filePath, input.symbol);
    }),

  suggestExtract: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), filePath: z.string(), selection: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, members: { some: { userId: ctx.user.id } } },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      return suggestExtract(input.projectId, input.filePath, input.selection);
    }),

  suggestSplit: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), filePath: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, members: { some: { userId: ctx.user.id } } },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      return suggestSplit(input.projectId, input.filePath);
    }),

  suggestSharedHelper: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), patternDescription: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, members: { some: { userId: ctx.user.id } } },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      return suggestSharedHelper(input.projectId, input.patternDescription);
    }),

  // --- AI fix it / PR drafts ---
  suggestFixes: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), instruction: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, members: { some: { userId: ctx.user.id } } },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      return suggestFixes(input.projectId, input.instruction);
    }),

  createPrDraft: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        branch: z.string(),
        title: z.string(),
        body: z.string(),
        changes: z.array(z.object({ filePath: z.string(), content: z.string(), operation: z.enum(['create', 'update', 'delete']).optional() })),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, members: { some: { userId: ctx.user.id } } },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });
      return createPrDraft(
        input.projectId,
        input.branch,
        input.title,
        input.body,
        input.changes,
        ctx.prisma
      );
    }),
});
