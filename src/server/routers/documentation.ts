// ============================================================
// LegacyLens — Documentation Router (LLD, HLD, System Design via Groq)
// ============================================================

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { generateLLD, generateHLD, generateSystemDesign } from '../services/documentationGenerator.js';
import type { ArchitectureGraph } from '../../types/index.js';

function buildArchitectureSummary(architectureJson: unknown): string {
  const graph = architectureJson as ArchitectureGraph | null;
  if (!graph?.nodes?.length) return 'No architecture graph available.';
  const nodes = graph.nodes as { filePath?: string; id?: string }[];
  const edges = (graph.edges || []) as { source: string; target: string; type?: string }[];
  const paths = nodes.map((n) => n.filePath ?? n.id ?? '').filter(Boolean);
  return `Total files in graph: ${paths.length}. Dependencies (edges): ${edges.length}.\nEntry points and high-dependency files shape the architecture.`;
}

function buildFileSummary(
  files: { filePath: string; fileType?: string | null; linesOfCode?: number | null }[]
): string {
  if (!files.length) return 'No indexed files.';
  const byType = new Map<string, number>();
  let totalLines = 0;
  for (const f of files) {
    const t = f.fileType || 'other';
    byType.set(t, (byType.get(t) || 0) + 1);
    totalLines += f.linesOfCode ?? 0;
  }
  const typeList = [...byType.entries()].map(([k, v]) => `${k}: ${v}`).join(', ');
  const topPaths = files
    .slice(0, 80)
    .map((f) => f.filePath)
    .join('\n');
  return `Total files: ${files.length}. Lines: ${totalLines}. By type: ${typeList}.\nSample paths:\n${topPaths}`;
}

export const documentationRouter = router({
  generateLLD: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: { some: { userId: ctx.user.id } },
        },
        select: {
          name: true,
          techStack: true,
          entryPoints: true,
          architectureJson: true,
          repoDescription: true,
          files: {
            select: { filePath: true, fileType: true, linesOfCode: true },
          },
        },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      const architectureSummary = buildArchitectureSummary(project.architectureJson);
      const fileSummary = buildFileSummary(project.files);
      const entryPoints = Array.isArray(project.entryPoints) ? project.entryPoints : [];

      return generateLLD({
        projectName: project.name,
        techStack: project.techStack ?? {},
        entryPoints,
        architectureSummary,
        fileSummary,
        repoDescription: project.repoDescription,
      });
    }),

  generateHLD: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: { some: { userId: ctx.user.id } },
        },
        select: {
          name: true,
          techStack: true,
          entryPoints: true,
          architectureJson: true,
          repoDescription: true,
          files: {
            select: { filePath: true, fileType: true, linesOfCode: true },
          },
        },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      const architectureSummary = buildArchitectureSummary(project.architectureJson);
      const fileSummary = buildFileSummary(project.files);
      const entryPoints = Array.isArray(project.entryPoints) ? project.entryPoints : [];

      return generateHLD({
        projectName: project.name,
        techStack: project.techStack ?? {},
        entryPoints,
        architectureSummary,
        fileSummary,
        repoDescription: project.repoDescription,
      });
    }),

  generateSystemDesign: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: { some: { userId: ctx.user.id } },
        },
        select: {
          name: true,
          techStack: true,
          entryPoints: true,
          architectureJson: true,
          repoDescription: true,
          files: {
            select: { filePath: true, fileType: true, linesOfCode: true },
          },
        },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      const architectureSummary = buildArchitectureSummary(project.architectureJson);
      const fileSummary = buildFileSummary(project.files);
      const entryPoints = Array.isArray(project.entryPoints) ? project.entryPoints : [];

      return generateSystemDesign({
        projectName: project.name,
        techStack: project.techStack ?? {},
        entryPoints,
        architectureSummary,
        fileSummary,
        repoDescription: project.repoDescription,
      });
    }),
});
