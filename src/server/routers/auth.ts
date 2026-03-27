// ============================================================
// LegacyLens — Auth Router
// ============================================================

import { z } from 'zod';
import { router, publicProcedure, protectedProcedure, logger } from '../trpc.js';

export const authRouter = router({
  // Get current session / user info
  getSession: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return null;

    return {
      id: ctx.user.id,
      email: ctx.user.email,
      name: ctx.user.name,
      credits: ctx.user.credits,
      subscriptionTier: ctx.user.subscriptionTier,
      githubUsername: ctx.user.githubUsername,
      avatarUrl: ctx.user.avatarUrl,
    };
  }),

  // Handle GitHub OAuth callback — creates or updates user record
  handleOAuthCallback: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().optional(),
        avatarUrl: z.string().url().optional(),
        githubId: z.string(),
        githubUsername: z.string().optional(),
        githubToken: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.prisma.user.upsert({
        where: { email: input.email },
        create: {
          email: input.email,
          name: input.name || null,
          avatarUrl: input.avatarUrl || null,
          githubId: input.githubId,
          githubUsername: input.githubUsername || null,
          githubToken: input.githubToken || null,
        },
        update: {
          name: input.name || undefined,
          avatarUrl: input.avatarUrl || undefined,
          githubUsername: input.githubUsername || undefined,
          githubToken: input.githubToken || undefined,
        },
      });

      logger.info({ userId: user.id }, 'User authenticated via GitHub OAuth');

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        credits: user.credits,
        subscriptionTier: user.subscriptionTier,
      };
    }),

  // Update user profile
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const updated = await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          name: input.name,
        },
        select: {
          id: true,
          email: true,
          name: true,
          credits: true,
          subscriptionTier: true,
        },
      });

      return updated;
    }),

  // Get user usage stats
  getUsageStats: protectedProcedure.query(async ({ ctx }) => {
    const [projectCount, qaCount, meetingCount, totalCreditsUsed] = await Promise.all([
      ctx.prisma.userToProject.count({
        where: { userId: ctx.user.id },
      }),
      ctx.prisma.qAConversation.count({
        where: { userId: ctx.user.id },
      }),
      ctx.prisma.usageLog.count({
        where: { userId: ctx.user.id, action: 'meeting' },
      }),
      ctx.prisma.usageLog.aggregate({
        where: { userId: ctx.user.id },
        _sum: { costCredits: true },
      }),
    ]);

    return {
      projectCount,
      qaCount,
      meetingCount,
      totalCreditsUsed: totalCreditsUsed._sum.costCredits || 0,
      remainingCredits: ctx.user.credits,
    };
  }),
});
