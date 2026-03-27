// ============================================================
// LegacyLens — Chat Router
// Team and direct messaging
// ============================================================

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, logger } from '../trpc.js';

export const chatRouter = router({
  // Get or create team channel for a project
  getTeamChannel: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      // Verify membership
      const isMember = await ctx.prisma.userToProject.findFirst({
        where: { projectId: input.projectId, userId: ctx.user.id },
      });

      if (!isMember) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      // Find or create team channel
      let channel = await ctx.prisma.chatChannel.findFirst({
        where: {
          projectId: input.projectId,
          type: 'team',
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, avatarUrl: true },
              },
            },
          },
        },
      });

      if (!channel) {
        channel = await ctx.prisma.chatChannel.create({
          data: {
            projectId: input.projectId,
            type: 'team',
            name: 'Team',
            members: {
              create: {
                userId: ctx.user.id,
                role: 'member',
              },
            },
          },
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, name: true, avatarUrl: true },
                },
              },
            },
          },
        });
      } else {
        // Ensure current user is a member
        const existingMember = await ctx.prisma.chatMember.findUnique({
          where: {
            channelId_userId: {
              channelId: channel.id,
              userId: ctx.user.id,
            },
          },
        });

        if (!existingMember) {
          await ctx.prisma.chatMember.create({
            data: {
              channelId: channel.id,
              userId: ctx.user.id,
              role: 'member',
            },
          });
        }
      }

      return channel;
    }),

  // Get messages for a channel
  getMessages: protectedProcedure
    .input(
      z.object({
        channelId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(50),
        before: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      // Verify membership
      const isMember = await ctx.prisma.chatMember.findFirst({
        where: {
          channelId: input.channelId,
          userId: ctx.user.id,
        },
      });

      if (!isMember) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const messages = await ctx.prisma.message.findMany({
        where: {
          channelId: input.channelId,
          ...(input.before && { id: { lt: input.before } }),
        },
        include: {
          user: {
            select: { id: true, name: true, avatarUrl: true },
          },
          replyTo: {
            include: {
              user: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
      });

      return messages.reverse(); // Return in chronological order
    }),

  // Send a message
  sendMessage: protectedProcedure
    .input(
      z.object({
        channelId: z.string().uuid(),
        content: z.string().min(1).max(5000),
        replyToId: z.string().uuid().optional(),
        mentions: z.array(z.string().uuid()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify membership
      const isMember = await ctx.prisma.chatMember.findFirst({
        where: {
          channelId: input.channelId,
          userId: ctx.user.id,
        },
      });

      if (!isMember) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const message = await ctx.prisma.message.create({
        data: {
          channelId: input.channelId,
          userId: ctx.user.id,
          content: input.content,
          replyToId: input.replyToId || null,
          mentions: input.mentions || [],
        },
        include: {
          user: {
            select: { id: true, name: true, avatarUrl: true },
          },
          replyTo: {
            include: {
              user: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });

      logger.info({ channelId: input.channelId, messageId: message.id, userId: ctx.user.id }, 'Message sent');

      return message;
    }),

  // Get or create DM channel between two users
  getDMChannel: protectedProcedure
    .input(z.object({ otherUserId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      // Find existing DM channel
      const existingChannel = await ctx.prisma.chatChannel.findFirst({
        where: {
          type: 'dm',
          members: {
            every: {
              userId: { in: [ctx.user.id, input.otherUserId] },
            },
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, avatarUrl: true },
              },
            },
          },
        },
      });

      if (existingChannel) {
        return existingChannel;
      }

      // Create new DM channel
      const channel = await ctx.prisma.chatChannel.create({
        data: {
          type: 'dm',
          members: {
            create: [
              { userId: ctx.user.id, role: 'member' },
              { userId: input.otherUserId, role: 'member' },
            ],
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, avatarUrl: true },
              },
            },
          },
        },
      });

      return channel;
    }),
});
