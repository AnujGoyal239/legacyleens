// ============================================================
// LegacyLens — DevOps / Incident Helper Router
// ============================================================

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, logger } from '../trpc.js';
import {
  getBlastRadiusFromGraph,
  getCallPathFromStackTrace,
  getIncidentContext,
  getRecentChangesForFile,
  getSafeChangeSuggestion,
  parseStackTrace,
} from '../services/incident.js';
import { searchCode } from '../services/search.js';
import { detectEnvVarsFromEmbeddings, detectRunbookFromIndexedFiles } from '../services/runbook.js';
import type { ArchitectureGraph } from '../../types/index.js';

export const devopsRouter = router({
  // Blast radius: which files depend on the given file?
  getBlastRadius: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        filePath: z.string().min(1),
      })
    )
    .query(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: { some: { userId: ctx.user.id } },
        },
        select: { architectureJson: true, name: true },
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      const graph = project.architectureJson as ArchitectureGraph | null;
      const dependents = getBlastRadiusFromGraph(graph, input.filePath);

      // Graph snippet: nodes for this file and its dependents
      const snippetFiles = new Set<string>([input.filePath, ...dependents]);
      let graphSnippet: { nodes: unknown[]; edges: unknown[] } = { nodes: [], edges: [] };
      if (graph?.nodes && graph?.edges) {
        graphSnippet = {
          nodes: (graph.nodes as { filePath?: string; id?: string }[]).filter((n) =>
            snippetFiles.has(n.filePath || n.id || '')
          ),
          edges: (graph.edges as { source: string; target: string }[]).filter(
            (e) => snippetFiles.has(e.source) || snippetFiles.has(e.target)
          ),
        };
      }

      return {
        filePath: input.filePath,
        dependents,
        dependentsCount: dependents.length,
        graphSnippet,
      };
    }),

  // Incident context: paste error → search results + optional runbook
  getIncidentContext: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        errorMessage: z.string().max(10000),
        includeRunbook: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
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
          message: 'Project must be fully indexed first',
        });
      }

      const result = await getIncidentContext(input.projectId, input.errorMessage, {
        includeRunbook: input.includeRunbook,
      });

      return result;
    }),

  // Recent commits for project or for a specific file
  getRecentChanges: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        filePath: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: { some: { userId: ctx.user.id } },
        },
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      const commits = await getRecentChangesForFile(ctx.prisma, input.projectId, {
        filePath: input.filePath,
        limit: input.limit,
      });

      return { commits };
    }),

  // Safe change suggestion: describe bug → suggested files + hint + blast-radius warning
  getSafeChangeSuggestion: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        bugDescription: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: { some: { userId: ctx.user.id } },
        },
        select: { architectureJson: true, status: true },
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      if (project.status !== 'complete') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Project must be fully indexed first',
        });
      }

      const searchResults = await searchCode(input.bugDescription, input.projectId, 8);
      if (searchResults.length === 0) {
        return {
          suggestedFiles: [],
          hint: 'No relevant code found. Try rephrasing the bug or ensure the project is indexed.',
          warning: undefined,
        };
      }

      const graph = project.architectureJson as ArchitectureGraph | null;
      const blastRadiusByFile: Record<string, string[]> = {};
      for (const r of searchResults) {
        blastRadiusByFile[r.filePath] = getBlastRadiusFromGraph(graph, r.filePath);
      }

      return getSafeChangeSuggestion(
        input.projectId,
        input.bugDescription,
        searchResults,
        blastRadiusByFile
      );
    }),

  // List incidents for a project
  listIncidents: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: { some: { userId: ctx.user.id } },
        },
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      const incidents = await ctx.prisma.incident.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return { incidents };
    }),

  // Create incident (post-incident learning)
  createIncident: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        summary: z.string().min(1).max(2000),
        rootCause: z.string().max(2000).optional(),
        filesChanged: z.array(z.string()).default([]),
        resolution: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: { some: { userId: ctx.user.id } },
        },
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      const incident = await ctx.prisma.incident.create({
        data: {
          projectId: input.projectId,
          summary: input.summary,
          rootCause: input.rootCause ?? null,
          filesChanged: input.filesChanged,
          resolution: input.resolution ?? null,
        },
      });

      logger.info({ projectId: input.projectId, incidentId: incident.id }, 'Incident created');
      return { incident };
    }),

  // Export context as markdown (for Slack / handoff)
  exportContext: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        filePath: z.string().optional(),
        errorMessage: z.string().max(5000).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: { some: { userId: ctx.user.id } },
        },
        select: { name: true, architectureJson: true },
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      const sections: string[] = [];
      sections.push(`# Incident context: ${project.name}`);
      sections.push('');

      if (input.filePath) {
        const graph = project.architectureJson as ArchitectureGraph | null;
        const dependents = getBlastRadiusFromGraph(graph, input.filePath);
        sections.push('## Blast radius');
        sections.push(`File: \`${input.filePath}\``);
        sections.push(`Affected (dependents): ${dependents.length}`);
        dependents.slice(0, 20).forEach((d) => sections.push(`- ${d}`));
        sections.push('');
      }

      const commits = await getRecentChangesForFile(ctx.prisma, input.projectId, {
        filePath: input.filePath,
        limit: 10,
      });
      sections.push('## Recent changes');
      if (commits.length === 0) {
        sections.push('No recent commits found.');
      } else {
        commits.forEach((c) => {
          sections.push(`- **${c.commitHash.slice(0, 7)}** ${c.message} (${c.author})`);
          if (c.filesChanged?.length) sections.push(`  Files: ${c.filesChanged.slice(0, 5).join(', ')}`);
        });
      }
      sections.push('');

      if (input.errorMessage) {
        const frames = parseStackTrace(input.errorMessage);
        if (frames.length > 0) {
          sections.push('## Stack trace (parsed)');
          frames.slice(0, 10).forEach((f) => {
            sections.push(`- ${f.filePath ?? '?'}:${f.line ?? '?'}`);
          });
        }
      }

      return { markdown: sections.join('\n') };
    }),

  // On-demand: detect rollback/hotfix runbook from indexed repo structure
  detectRunbook: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, members: { some: { userId: ctx.user.id } } },
        select: { id: true, status: true },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      if (project.status !== 'complete') {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Project must be fully indexed first' });
      }

      const detected = await detectRunbookFromIndexedFiles(ctx.prisma, input.projectId);
      return { detected };
    }),

  // Save (upsert) runbook edits for a project
  saveRunbook: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        rollbackSteps: z.string().max(20000).optional(),
        hotfixSteps: z.string().max(20000).optional(),
        envVars: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, members: { some: { userId: ctx.user.id } } },
        select: { id: true },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      // Note: Prisma client types may be stale until `prisma generate` is run after adding the model.
      const runbook = await (ctx.prisma as any).projectRunbook.upsert({
        where: { projectId: input.projectId },
        create: {
          projectId: input.projectId,
          rollbackSteps: input.rollbackSteps ?? null,
          hotfixSteps: input.hotfixSteps ?? null,
          envVars: input.envVars ?? [],
        },
        update: {
          rollbackSteps: input.rollbackSteps ?? undefined,
          hotfixSteps: input.hotfixSteps ?? undefined,
          envVars: input.envVars ?? undefined,
        },
      });
      return { runbook };
    }),

  // Get runbook (saved if exists; otherwise null)
  getRunbook: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, members: { some: { userId: ctx.user.id } } },
        select: { id: true },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      const runbook = await (ctx.prisma as any).projectRunbook.findUnique({
        where: { projectId: input.projectId },
      });
      return { runbook };
    }),

  // On-demand: detect env var usage from stored embedding content
  detectEnvVars: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, members: { some: { userId: ctx.user.id } } },
        select: { id: true, status: true },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      if (project.status !== 'complete') {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Project must be fully indexed first' });
      }

      const env = await detectEnvVarsFromEmbeddings(ctx.prisma, input.projectId);
      return { env };
    }),

  // Incident replay: stack trace → call path (entry → ... → failure)
  getIncidentReplay: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        stackTrace: z.string().min(1).max(15000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, members: { some: { userId: ctx.user.id } } },
        select: { id: true, status: true },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      if (project.status !== 'complete') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Project must be fully indexed first',
        });
      }

      const path = await getCallPathFromStackTrace(ctx.prisma, input.projectId, input.stackTrace);
      return { path };
    }),
});
