// ============================================================
// LegacyLens — Team Router
// Team collaboration and activity tracking
// ============================================================

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, logger } from '../trpc.js';

export const teamRouter = router({
  // Get team members for a project
  getMembers: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      // Verify membership
      const isMember = await ctx.prisma.userToProject.findFirst({
        where: { projectId: input.projectId, userId: ctx.user.id },
      });

      if (!isMember) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member of this project' });
      }

      const members = await ctx.prisma.userToProject.findMany({
        where: { projectId: input.projectId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              githubUsername: true,
            },
          },
        },
        orderBy: [
          { role: 'asc' }, // owner first, then admin, member, viewer
          { joinedAt: 'asc' },
        ],
      });

      return members;
    }),

  // Get team activity feed
  getActivity: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(50),
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

      const activities: Array<{
        type: string;
        timestamp: Date;
        user?: { id: string; name: string | null; avatarUrl: string | null };
        data: unknown;
      }> = [];

      // Recent commits
      const commits = await ctx.prisma.commit.findMany({
        where: { projectId: input.projectId },
        orderBy: { committedAt: 'desc' },
        take: Math.floor(input.limit * 0.4),
        select: {
          id: true,
          commitHash: true,
          message: true,
          author: true,
          authorEmail: true,
          committedAt: true,
          filesChanged: true,
        },
      });

      for (const commit of commits) {
        // Try to find user by email or GitHub username
        let user = await ctx.prisma.user.findFirst({
          where: {
            OR: [
              { email: commit.authorEmail || '' },
              { githubUsername: commit.author },
            ],
          },
          select: { id: true, name: true, avatarUrl: true },
        });

        activities.push({
          type: 'commit',
          timestamp: commit.committedAt,
          user: user || undefined,
          data: {
            id: commit.id,
            hash: commit.commitHash,
            message: commit.message,
            author: commit.author,
            filesChanged: commit.filesChanged.length,
          },
        });
      }

      // Recent board card moves/creates
      const board = await ctx.prisma.board.findFirst({
        where: { projectId: input.projectId },
        include: {
          columns: {
            include: {
              cards: {
                include: {
                  assignedTo: {
                    select: { id: true, name: true, avatarUrl: true },
                  },
                },
                orderBy: { updatedAt: 'desc' },
                take: Math.floor(input.limit * 0.3),
              },
            },
          },
        },
      });

      if (board) {
        for (const column of board.columns) {
          for (const card of column.cards) {
            activities.push({
              type: 'card',
              timestamp: card.updatedAt,
              user: card.assignedTo || undefined,
              data: {
                id: card.id,
                title: card.title,
                columnName: column.name,
              },
            });
          }
        }
      }

      // Recent Q&A questions
      const qaConversations = await ctx.prisma.qaConversation.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: 'desc' },
        take: Math.floor(input.limit * 0.2),
        include: {
          user: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      });

      for (const qa of qaConversations) {
        activities.push({
          type: 'qa',
          timestamp: qa.createdAt,
          user: {
            id: qa.user.id,
            name: qa.user.name,
            avatarUrl: qa.user.avatarUrl,
          },
          data: {
            id: qa.id,
            question: qa.question,
            hasAnswer: !!qa.answer,
          },
        });
      }

      // Recent meetings
      const meetings = await ctx.prisma.meeting.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: 'desc' },
        take: Math.floor(input.limit * 0.1),
        select: {
          id: true,
          title: true,
          createdAt: true,
          transcriptionStatus: true,
        },
      });

      for (const meeting of meetings) {
        activities.push({
          type: 'meeting',
          timestamp: meeting.createdAt,
          data: {
            id: meeting.id,
            title: meeting.title || 'Untitled Meeting',
            status: meeting.transcriptionStatus,
          },
        });
      }

      // Sort by timestamp (most recent first)
      activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return activities.slice(0, input.limit);
    }),

  // Get team progress/stats
  getProgress: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      // Verify membership
      const isMember = await ctx.prisma.userToProject.findFirst({
        where: { projectId: input.projectId, userId: ctx.user.id },
      });

      if (!isMember) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      // Get all members
      const members = await ctx.prisma.userToProject.findMany({
        where: { projectId: input.projectId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              githubUsername: true,
            },
          },
        },
      });

      // Calculate stats per member
      const memberStats = await Promise.all(
        members.map(async (member) => {
          const userId = member.user.id;

          // Commits (by author email or GitHub username)
          const commits = await ctx.prisma.commit.findMany({
            where: {
              projectId: input.projectId,
              OR: [
                { authorEmail: member.user.email },
                { author: member.user.githubUsername || '' },
              ],
            },
          });

          // Board cards assigned
          const board = await ctx.prisma.board.findFirst({
            where: { projectId: input.projectId },
            include: {
              columns: {
                include: {
                  cards: {
                    where: { assignedToId: userId },
                  },
                },
              },
            },
          });

          const cardsAssigned = board?.columns.reduce((sum, col) => sum + col.cards.length, 0) ?? 0;

          // Q&A questions asked
          const qaCount = await ctx.prisma.qaConversation.count({
            where: { projectId: input.projectId, userId },
          });

          // Meetings (all members can see all meetings)
          const meetingsCount = await ctx.prisma.meeting.count({
            where: { projectId: input.projectId },
          });

          return {
            userId,
            userName: member.user.name || member.user.email,
            userAvatar: member.user.avatarUrl,
            role: member.role,
            joinedAt: member.joinedAt,
            stats: {
              commits: commits.length,
              cardsAssigned,
              qaQuestions: qaCount,
              meetingsAttended: meetingsCount, // All members see all meetings
            },
          };
        })
      );

      // Overall project stats
      const totalCommits = await ctx.prisma.commit.count({
        where: { projectId: input.projectId },
      });

      const board = await ctx.prisma.board.findFirst({
        where: { projectId: input.projectId },
        include: {
          columns: {
            include: {
              cards: true,
            },
          },
        },
      });

      const totalCards = board?.columns.reduce((sum, col) => sum + col.cards.length, 0) ?? 0;
      const completedCards =
        board?.columns
          .filter((col) => col.name.toLowerCase().includes('done') || col.name.toLowerCase().includes('complete'))
          .reduce((sum, col) => sum + col.cards.length, 0) ?? 0;

      return {
        members: memberStats,
        projectStats: {
          totalMembers: members.length,
          totalCommits,
          totalCards,
          completedCards,
          completionRate: totalCards > 0 ? (completedCards / totalCards) * 100 : 0,
        },
      };
    }),

  // Get recent commits by team members
  getRecentCommits: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        limit: z.number().min(1).max(50).default(20),
        authorId: z.string().uuid().optional(),
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

      let whereClause: { projectId: string; authorEmail?: string; author?: string } = {
        projectId: input.projectId,
      };

      // Filter by specific author if provided
      if (input.authorId) {
        const user = await ctx.prisma.user.findUnique({
          where: { id: input.authorId },
          select: { email: true, githubUsername: true },
        });

        if (user) {
          whereClause = {
            projectId: input.projectId,
            OR: [
              { authorEmail: user.email || undefined },
              { author: user.githubUsername || undefined },
            ],
          };
        }
      }

      const commits = await ctx.prisma.commit.findMany({
        where: whereClause,
        orderBy: { committedAt: 'desc' },
        take: input.limit,
        include: {
          project: {
            select: { name: true },
          },
        },
      });

      // Enrich with user info
      const enrichedCommits = await Promise.all(
        commits.map(async (commit) => {
          const user = await ctx.prisma.user.findFirst({
            where: {
              OR: [
                { email: commit.authorEmail || '' },
                { githubUsername: commit.author },
              ],
            },
            select: { id: true, name: true, avatarUrl: true },
          });

          return {
            ...commit,
            user: user || null,
          };
        })
      );

      return enrichedCommits;
    }),
});
