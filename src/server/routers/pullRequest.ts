// ============================================================
// LegacyLens — Pull Request Router
// GitHub PR fetching and syncing
// ============================================================

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, logger } from '../trpc.js';
import { parseGitHubUrl, fetchFileContent } from '../services/github.js';
import { syncPRsToDatabase, fetchGitHubPRs } from '../services/githubPr.js';

export const pullRequestRouter = router({
  // Sync PRs from GitHub to database
  sync: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // Verify membership
      const isMember = await ctx.prisma.userToProject.findFirst({
        where: { projectId: input.projectId, userId: ctx.user.id },
      });

      if (!isMember) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        select: {
          githubUrl: true,
          githubPat: true,
          repoOwner: true,
          repoName: true,
        },
      });

      if (!project || !project.githubUrl) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Project does not have a GitHub repository' });
      }

      const owner = project.repoOwner;
      const repo = project.repoName;

      if (!owner || !repo) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Could not determine repository owner/name' });
      }

      const synced = await syncPRsToDatabase(ctx.prisma, input.projectId, owner, repo, project.githubPat);

      logger.info({ projectId: input.projectId, synced }, 'PRs synced from GitHub');

      return { synced };
    }),

  // Get PRs for a project
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        state: z.enum(['open', 'closed', 'all']).default('all'),
      })
    )
    .query(async ({ input, ctx }) => {
      // Verify membership
      const isMember = await ctx.prisma.userToProject.findFirst({
        where: { projectId: input.projectId, userId: ctx.user.id },
      });

      if (!isMember) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const prs = await ctx.prisma.pullRequest.findMany({
        where: {
          projectId: input.projectId,
          ...(input.state !== 'all' && { state: input.state }),
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      });

      return prs;
    }),

  // Get a single PR
  get: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), prId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      // Verify membership
      const isMember = await ctx.prisma.userToProject.findFirst({
        where: { projectId: input.projectId, userId: ctx.user.id },
      });

      if (!isMember) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const pr = await ctx.prisma.pullRequest.findFirst({
        where: {
          id: input.prId,
          projectId: input.projectId,
        },
      });

      if (!pr) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return pr;
    }),
});
