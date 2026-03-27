// ============================================================
// LegacyLens — Architecture Router
// ============================================================

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';

export const architectureRouter = router({
  getGraph: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: { some: { userId: ctx.user.id } },
        },
        select: { id: true, architectureJson: true },
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      const raw = project.architectureJson as {
        nodes?: Array<{ id: string; filePath: string }>;
        edges?: Array<{ source: string; target: string }>;
      } | null;

      if (!raw || !raw.nodes?.length) {
        return { nodes: [], links: [] };
      }

      // Enrich nodes with File metadata
      const filePaths = raw.nodes.map((n) => n.filePath);
      const files = await ctx.prisma.file.findMany({
        where: { projectId: input.projectId, filePath: { in: filePaths } },
        select: {
          filePath: true,
          fileType: true,
          linesOfCode: true,
          riskLevel: true,
          dependentsCount: true,
          dependenciesCount: true,
          isEntryPoint: true,
        },
      });

      const fileMap = new Map(files.map((f) => [f.filePath, f]));

      const nodes = raw.nodes
        .filter((n) => fileMap.has(n.filePath))
        .map((n) => {
          const f = fileMap.get(n.filePath)!;
          return {
            id: n.filePath,
            filePath: n.filePath,
            fileType: f.fileType,
            linesOfCode: f.linesOfCode,
            riskLevel: f.riskLevel,
            dependentsCount: f.dependentsCount,
            dependenciesCount: f.dependenciesCount,
            isEntryPoint: f.isEntryPoint,
          };
        });

      const nodeSet = new Set(nodes.map((n) => n.filePath));

      const links = (raw.edges ?? [])
        .filter((e) => nodeSet.has(e.source) && nodeSet.has(e.target))
        .map((e) => ({ source: e.source, target: e.target }));

      return { nodes, links };
    }),
});
