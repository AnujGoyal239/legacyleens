// ============================================================
// LegacyLens — Google Meet Router
// OAuth flow, schedule meetings, list upcoming, import to project
// ============================================================

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, publicProcedure, logger } from '../trpc.js';
import {
  getAuthUrl,
  exchangeCodeForTokens,
  scheduleMeeting,
  listUpcomingMeetings,
  getMeetingEvent,
  cancelMeeting,
  isGoogleMeetConfigured,
} from '../services/googleMeet.js';

export const googleMeetRouter = router({
  // Check if Google Meet is configured and if user has connected
  status: protectedProcedure.query(async ({ ctx }) => {
    const configured = isGoogleMeetConfigured();
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: { googleAccessToken: true, googleRefreshToken: true },
    });
    return {
      configured,
      connected: !!(user?.googleAccessToken),
    };
  }),

  // Get Google OAuth URL to connect account
  getAuthUrl: protectedProcedure.query(({ ctx }) => {
    if (!isGoogleMeetConfigured()) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Google Meet integration is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
      });
    }
    const url = getAuthUrl(ctx.user.id);
    return { url };
  }),

  // Exchange OAuth code for tokens (called after redirect)
  connectGoogle: protectedProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const tokens = await exchangeCodeForTokens(input.code);

      await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          googleAccessToken: tokens.access_token ?? null,
          googleRefreshToken: tokens.refresh_token ?? null,
        },
      });

      logger.info({ userId: ctx.user.id }, 'Google account connected');
      return { success: true };
    }),

  // Disconnect Google account
  disconnectGoogle: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.user.update({
      where: { id: ctx.user.id },
      data: {
        googleAccessToken: null,
        googleRefreshToken: null,
      },
    });
    return { success: true };
  }),

  // Schedule a new meeting via Google Calendar + Meet
  schedule: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        title: z.string().min(1).max(200),
        description: z.string().max(1000).optional(),
        startTime: z.string(), // ISO 8601
        durationMinutes: z.number().int().min(5).max(480).default(30),
        attendeeEmails: z.array(z.string().email()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, members: { some: { userId: ctx.user.id } } },
      });
      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.user.id },
        select: { googleAccessToken: true, googleRefreshToken: true },
      });
      if (!user?.googleAccessToken) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Google account not connected. Please connect your Google account first.',
        });
      }

      const event = await scheduleMeeting({
        accessToken: user.googleAccessToken,
        refreshToken: user.googleRefreshToken,
        title: input.title,
        description: input.description,
        startTime: input.startTime,
        durationMinutes: input.durationMinutes,
        attendeeEmails: input.attendeeEmails,
      });

      const meeting = await ctx.prisma.meeting.create({
        data: {
          projectId: input.projectId,
          title: input.title,
          source: 'google_meet',
          transcriptionStatus: 'pending',
          googleEventId: event.eventId,
          googleMeetLink: event.meetLink,
        },
      });

      logger.info({ meetingId: meeting.id, eventId: event.eventId }, 'Google Meet scheduled');

      return {
        meetingId: meeting.id,
        eventId: event.eventId,
        meetLink: event.meetLink,
        htmlLink: event.htmlLink,
        startTime: event.startTime,
        endTime: event.endTime,
      };
    }),

  // List upcoming Google Calendar meetings with Meet links
  listUpcoming: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: { googleAccessToken: true, googleRefreshToken: true },
    });
    if (!user?.googleAccessToken) {
      return { meetings: [], connected: false };
    }

    try {
      const meetings = await listUpcomingMeetings({
        accessToken: user.googleAccessToken,
        refreshToken: user.googleRefreshToken,
      });
      return { meetings, connected: true };
    } catch (err) {
      logger.warn({ err }, 'Failed to list Google Calendar meetings');
      return { meetings: [], connected: true, error: 'Failed to fetch meetings from Google Calendar' };
    }
  }),

  // Get details for a specific Google Calendar event
  getEvent: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input, ctx }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.user.id },
        select: { googleAccessToken: true, googleRefreshToken: true },
      });
      if (!user?.googleAccessToken) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Google not connected' });
      }

      return getMeetingEvent({
        accessToken: user.googleAccessToken,
        refreshToken: user.googleRefreshToken,
        eventId: input.eventId,
      });
    }),

  // Cancel a Google Calendar meeting
  cancel: protectedProcedure
    .input(z.object({ meetingId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const meeting = await ctx.prisma.meeting.findUnique({
        where: { id: input.meetingId },
        include: {
          project: { include: { members: { select: { userId: true } } } },
        },
      });
      if (!meeting) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      if (!meeting.project.members.some((m) => m.userId === ctx.user.id)) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      if (!meeting.googleEventId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Not a Google Meet meeting' });
      }

      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.user.id },
        select: { googleAccessToken: true, googleRefreshToken: true },
      });
      if (user?.googleAccessToken) {
        try {
          await cancelMeeting({
            accessToken: user.googleAccessToken,
            refreshToken: user.googleRefreshToken,
            eventId: meeting.googleEventId,
          });
        } catch (err) {
          logger.warn({ err, eventId: meeting.googleEventId }, 'Failed to cancel Google event');
        }
      }

      await ctx.prisma.meeting.delete({ where: { id: input.meetingId } });
      return { success: true };
    }),
});
