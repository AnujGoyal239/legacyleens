// ============================================================
// LegacyLens — Meeting Router
// ============================================================

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, logger } from '../trpc.js';
import { transcriptionQueue } from '../queues/index.js';
import {
  generateMeetingSummary,
  extractMeetingInsights,
  answerMeetingQuestion,
} from '../services/llm.js';

export const meetingRouter = router({
  // Upload & start processing a meeting
  upload: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
        fileUrl: z.string().url(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify project access
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: { some: { userId: ctx.user.id } },
        },
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      // Check credits (10 per meeting)
      if (ctx.user.credits < 10) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Insufficient credits (10 required for meeting upload)',
        });
      }

      // Create meeting record and deduct credits
      const [meeting] = await ctx.prisma.$transaction([
        ctx.prisma.meeting.create({
          data: {
            projectId: input.projectId,
            title: input.title || 'Untitled Meeting',
            fileUrl: input.fileUrl,
            transcriptionStatus: 'pending',
          },
        }),
        ctx.prisma.user.update({
          where: { id: ctx.user.id },
          data: { credits: { decrement: 10 } },
        }),
        ctx.prisma.usageLog.create({
          data: {
            userId: ctx.user.id,
            projectId: input.projectId,
            action: 'meeting',
            costCredits: 10,
          },
        }),
      ]);

      // Enqueue transcription job
      await transcriptionQueue.add('transcribe', {
        meetingId: meeting.id,
        fileUrl: input.fileUrl,
        projectId: input.projectId,
      });

      logger.info({ meetingId: meeting.id }, 'Meeting uploaded, transcription enqueued');

      return meeting;
    }),

  // List meetings for a project
  list: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      // Verify project access
      const isMember = await ctx.prisma.userToProject.findFirst({
        where: {
          projectId: input.projectId,
          userId: ctx.user.id,
        },
      });

      if (!isMember) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const meetings = await ctx.prisma.meeting.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          durationSeconds: true,
          transcriptionStatus: true,
          source: true,
          summary: true,
          createdAt: true,
          insights: true,
          googleEventId: true,
          googleMeetLink: true,
        },
      });

      return meetings;
    }),

  // Get meeting details with transcript
  get: protectedProcedure
    .input(z.object({ meetingId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const meeting = await ctx.prisma.meeting.findUnique({
        where: { id: input.meetingId },
        include: {
          project: {
            include: {
              members: {
                select: { userId: true },
              },
            },
          },
        },
      });

      if (!meeting) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' });
      }

      // Verify access via project membership
      const isMember = meeting.project.members.some((m) => m.userId === ctx.user.id);
      if (!isMember) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      return {
        id: meeting.id,
        title: meeting.title,
        durationSeconds: meeting.durationSeconds,
        fileUrl: meeting.fileUrl,
        source: meeting.source,
        summary: meeting.summary,
        transcriptionStatus: meeting.transcriptionStatus,
        transcriptText: meeting.transcriptText,
        insights: meeting.insights,
        createdAt: meeting.createdAt,
      };
    }),

  // Start a live meeting (creates record; client will send transcript on end)
  startLive: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
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
      if (ctx.user.credits < 5) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Insufficient credits (5 required for live meeting)',
        });
      }

      const meeting = await ctx.prisma.meeting.create({
        data: {
          projectId: input.projectId,
          title: input.title || 'Live Meeting',
          fileUrl: null,
          source: 'live',
          transcriptionStatus: 'live',
        },
      });

      await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: { credits: { decrement: 5 } },
      });
      await ctx.prisma.usageLog.create({
        data: {
          userId: ctx.user.id,
          projectId: input.projectId,
          action: 'meeting',
          costCredits: 5,
        },
      });

      logger.info({ meetingId: meeting.id }, 'Live meeting started');
      return meeting;
    }),

  // End live meeting: save transcript, generate summary and insights
  endLive: protectedProcedure
    .input(
      z.object({
        meetingId: z.string().uuid(),
        transcriptText: z.string().min(1),
        durationSeconds: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const meeting = await ctx.prisma.meeting.findUnique({
        where: { id: input.meetingId },
        include: {
          project: {
            include: { members: { select: { userId: true } } },
          },
        },
      });
      if (!meeting) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' });
      }
      if (meeting.transcriptionStatus !== 'live') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Meeting is not a live meeting',
        });
      }
      const isMember = meeting.project.members.some((m) => m.userId === ctx.user.id);
      if (!isMember) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const [summary, insights] = await Promise.all([
        generateMeetingSummary(input.transcriptText),
        extractMeetingInsights(input.transcriptText),
      ]);

      const updated = await ctx.prisma.meeting.update({
        where: { id: input.meetingId },
        data: {
          transcriptionStatus: 'complete',
          transcriptText: input.transcriptText,
          summary: summary || null,
          insights: JSON.parse(JSON.stringify(insights)),
          durationSeconds: input.durationSeconds ?? undefined,
        },
      });

      logger.info({ meetingId: input.meetingId }, 'Live meeting ended, summary generated');
      return updated;
    }),

  // Meet Buddy: ask a question about a meeting (chatbot that answers from transcript)
  askMeetBuddy: protectedProcedure
    .input(
      z.object({
        meetingId: z.string().uuid(),
        question: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const meeting = await ctx.prisma.meeting.findUnique({
        where: { id: input.meetingId },
        include: {
          project: {
            include: { members: { select: { userId: true } } },
          },
        },
      });
      if (!meeting) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' });
      }
      const isMember = meeting.project.members.some((m) => m.userId === ctx.user.id);
      if (!isMember) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      if (!meeting.transcriptText) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No transcript available for this meeting',
        });
      }

      const insights = (meeting.insights as {
        decisions?: string[];
        actionItems?: string[];
        risks?: string[];
        technicalDiscussions?: Array<{ topic: string; summary: string }>;
      }) ?? {};

      const answer = await answerMeetingQuestion(
        input.question,
        meeting.transcriptText,
        meeting.summary ?? '',
        insights
      );
      return { answer };
    }),

  // Delete meeting
  delete: protectedProcedure
    .input(z.object({ meetingId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const meeting = await ctx.prisma.meeting.findUnique({
        where: { id: input.meetingId },
        include: {
          project: {
            include: {
              members: {
                where: { userId: ctx.user.id, role: { in: ['owner', 'admin'] } },
              },
            },
          },
        },
      });

      if (!meeting || meeting.project.members.length === 0) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      await ctx.prisma.meeting.delete({
        where: { id: input.meetingId },
      });

      return { success: true };
    }),
});
