// ============================================================
// LegacyLens — Board Router (Kanban Task Management)
// ============================================================

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, logger } from '../trpc.js';
import { generateAnswer } from '../services/llm.js';

export const boardRouter = router({
  // Get board for project (auto-creates default board if none exists)
  get: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      // Verify membership
      const isMember = await ctx.prisma.userToProject.findFirst({
        where: { projectId: input.projectId, userId: ctx.user.id },
      });

      if (!isMember) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      // Try to find existing board
      let board = await ctx.prisma.board.findFirst({
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
                orderBy: { position: 'asc' },
              },
            },
            orderBy: { position: 'asc' },
          },
        },
      });

      // Auto-create default board with columns
      if (!board) {
        board = await ctx.prisma.board.create({
          data: {
            projectId: input.projectId,
            name: 'Onboarding',
            columns: {
              create: [
                { name: 'To Learn', position: 0 },
                { name: 'Exploring', position: 1 },
                { name: 'Understood', position: 2 },
                { name: 'Ready to Modify', position: 3 },
              ],
            },
          },
          include: {
            columns: {
              include: {
                cards: {
                  include: {
                    assignedTo: {
                      select: { id: true, name: true, avatarUrl: true },
                    },
                  },
                  orderBy: { position: 'asc' },
                },
              },
              orderBy: { position: 'asc' },
            },
          },
        });
      }

      return board;
    }),

  // Create a new card
  createCard: protectedProcedure
    .input(
      z.object({
        columnId: z.string().uuid(),
        title: z.string().min(1).max(200),
        description: z.string().max(1000).optional(),
        linkedFiles: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Get the max position in the column
      const maxCard = await ctx.prisma.card.findFirst({
        where: { columnId: input.columnId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      const card = await ctx.prisma.card.create({
        data: {
          columnId: input.columnId,
          title: input.title,
          description: input.description || null,
          linkedFiles: input.linkedFiles || [],
          linkedQaIds: [],
          position: (maxCard?.position ?? -1) + 1,
        },
        include: {
          assignedTo: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      });

      return card;
    }),

  // Move card to a different column and/or position
  moveCard: protectedProcedure
    .input(
      z.object({
        cardId: z.string().uuid(),
        columnId: z.string().uuid(),
        position: z.number().int().min(0),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const card = await ctx.prisma.card.update({
        where: { id: input.cardId },
        data: {
          columnId: input.columnId,
          position: input.position,
        },
        include: {
          assignedTo: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      });

      return card;
    }),

  // Update card details
  updateCard: protectedProcedure
    .input(
      z.object({
        cardId: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(1000).optional(),
        linkedFiles: z.array(z.string()).optional(),
        assignedToId: z.string().uuid().nullable().optional(),
        timeSpentMinutes: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { cardId, ...data } = input;

      const card = await ctx.prisma.card.update({
        where: { id: cardId },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.linkedFiles !== undefined && { linkedFiles: data.linkedFiles }),
          ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId }),
          ...(data.timeSpentMinutes !== undefined && { timeSpentMinutes: data.timeSpentMinutes }),
        },
        include: {
          assignedTo: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      });

      return card;
    }),

  // Delete card
  deleteCard: protectedProcedure
    .input(z.object({ cardId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.card.delete({
        where: { id: input.cardId },
      });

      return { success: true };
    }),

  // Add column to board
  addColumn: protectedProcedure
    .input(
      z.object({
        boardId: z.string().uuid(),
        name: z.string().min(1).max(50),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const maxColumn = await ctx.prisma.column.findFirst({
        where: { boardId: input.boardId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      const column = await ctx.prisma.column.create({
        data: {
          boardId: input.boardId,
          name: input.name,
          position: (maxColumn?.position ?? -1) + 1,
        },
        include: {
          cards: true,
        },
      });

      return column;
    }),

  // Delete column (with all cards)
  deleteColumn: protectedProcedure
    .input(z.object({ columnId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.column.delete({
        where: { id: input.columnId },
      });

      return { success: true };
    }),

  // AI Suggest Tasks — generates 5 onboarding task titles and adds them to "To Learn"
  suggestTasks: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const isMember = await ctx.prisma.userToProject.findFirst({
        where: { projectId: input.projectId, userId: ctx.user.id },
      });
      if (!isMember) throw new TRPCError({ code: 'FORBIDDEN' });

      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId },
        select: {
          name: true,
          techStack: true,
          files: {
            orderBy: { dependentsCount: 'desc' },
            take: 5,
            select: { filePath: true, dependentsCount: true },
          },
        },
      });
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' });

      const topFiles = project.files.map((f) => f.filePath).join(', ');
      const techStr = project.techStack ? JSON.stringify(project.techStack).slice(0, 200) : 'unknown';

      const prompt = `You are an onboarding assistant. Generate exactly 5 beginner-friendly onboarding task titles for a new developer joining the "${project.name}" project.

Tech stack: ${techStr}
Critical files: ${topFiles}

Return ONLY a JSON array of 5 short task title strings. No explanations. Example: ["Read the README", "Understand the auth flow", ...]`;

      let taskTitles: string[] = [];
      try {
        const result = await generateAnswer(prompt, []);
        const match = result.text.match(/\[[\s\S]*\]/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed)) {
            taskTitles = parsed.slice(0, 5).map(String).filter(Boolean);
          }
        }
      } catch (err) {
        logger.warn({ err }, 'AI suggest tasks LLM call failed, using defaults');
      }

      // Fallback if LLM fails
      if (taskTitles.length < 5) {
        taskTitles = [
          `Read the ${project.name} README`,
          'Understand the project folder structure',
          'Trace the main entry point',
          'Review the critical files',
          'Run the project locally',
        ].slice(0, 5);
      }

      // Find or create board + "To Learn" column
      let board = await ctx.prisma.board.findFirst({ where: { projectId: input.projectId } });
      if (!board) {
        board = await ctx.prisma.board.create({
          data: {
            projectId: input.projectId,
            name: 'Onboarding',
            columns: { create: [
              { name: 'To Learn', position: 0 },
              { name: 'Exploring', position: 1 },
              { name: 'Understood', position: 2 },
              { name: 'Ready to Modify', position: 3 },
            ]},
          },
        });
      }

      let toLearnCol = await ctx.prisma.column.findFirst({
        where: { boardId: board.id, name: 'To Learn' },
      });
      if (!toLearnCol) {
        toLearnCol = await ctx.prisma.column.create({
          data: { boardId: board.id, name: 'To Learn', position: 0 },
        });
      }

      const maxCard = await ctx.prisma.card.findFirst({
        where: { columnId: toLearnCol.id },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      let pos = (maxCard?.position ?? -1) + 1;

      const cards = [];
      for (const title of taskTitles) {
        const card = await ctx.prisma.card.create({
          data: {
            columnId: toLearnCol.id,
            title,
            linkedFiles: project.files.slice(0, 2).map((f) => f.filePath),
            linkedQaIds: [],
            position: pos++,
          },
        });
        cards.push(card);
      }

      logger.info({ projectId: input.projectId, count: cards.length }, 'AI tasks suggested');
      return { tasks: taskTitles, columnId: toLearnCol.id };
    }),
});
