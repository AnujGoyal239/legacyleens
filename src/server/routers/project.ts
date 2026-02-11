// ============================================================
// LegacyLens — Project Router
// ============================================================

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, logger } from '../trpc.js';
import { indexingQueue } from '../queues/index.js';
import { parseGitHubUrl, fetchRepoMetadata } from '../services/github.js';

export const projectRouter = router({
  // List all projects for current user
  list: protectedProcedure.query(async ({ ctx }) => {
    const projects = await ctx.prisma.project.findMany({
      where: {
        members: {
          some: { userId: ctx.user.id },
        },
      },
      select: {
        id: true,
        name: true,
        githubUrl: true,
        defaultBranch: true,
        status: true,
        totalFiles: true,
        totalLines: true,
        processedFiles: true,
        indexingError: true,
        // Repo metadata
        repoOwner: true,
        repoName: true,
        repoDescription: true,
        repoStars: true,
        repoForks: true,
        repoLanguage: true,
        repoVisibility: true,
        repoTopics: true,
        repoAvatarUrl: true,
        createdAt: true,
        updatedAt: true,
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
        _count: {
          select: { files: true, qaConversations: true, meetings: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return projects;
  }),

  // Create new project — GitHub URL is mandatory
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        githubUrl: z
          .string()
          .url()
          .refine((url) => url.startsWith('https://github.com/'), {
            message: 'Must be a GitHub repository URL (e.g. https://github.com/owner/repo)',
          }),
        isPrivate: z.boolean().default(false),
        githubPat: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // If private, PAT is required
      if (input.isPrivate && !input.githubPat) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'A GitHub Personal Access Token is required for private repositories.',
        });
      }

      // Parse owner/repo from URL
      const parsed = parseGitHubUrl(input.githubUrl);
      if (!parsed) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid GitHub URL. Expected format: https://github.com/owner/repo',
        });
      }

      // Check tier limits
      const projectCount = await ctx.prisma.userToProject.count({
        where: { userId: ctx.user.id, role: 'owner' },
      });

      const limits: Record<string, number> = {
        free: 1,
        pro: 10,
        team: 100,
        enterprise: 1000,
      };

      const maxProjects = limits[ctx.user.subscriptionTier] || 1;

      if (projectCount >= maxProjects) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `You've reached the maximum of ${maxProjects} projects for your ${ctx.user.subscriptionTier} plan. Please upgrade.`,
        });
      }

      // Fetch repo metadata from GitHub API
      let repoMeta;
      try {
        repoMeta = await fetchRepoMetadata(
          parsed.owner,
          parsed.repo,
          input.isPrivate ? input.githubPat : undefined
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch repository details';
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message,
        });
      }

      // Create project with fetched GitHub metadata
      const project = await ctx.prisma.project.create({
        data: {
          name: input.name,
          githubUrl: input.githubUrl,
          repoOwner: repoMeta.owner,
          repoName: repoMeta.name,
          repoDescription: repoMeta.description,
          repoStars: repoMeta.stars,
          repoForks: repoMeta.forks,
          repoLanguage: repoMeta.language,
          repoVisibility: repoMeta.visibility,
          repoTopics: repoMeta.topics,
          repoAvatarUrl: repoMeta.avatarUrl,
          defaultBranch: repoMeta.defaultBranch,
          githubPat: input.isPrivate ? input.githubPat : null,
          members: {
            create: {
              userId: ctx.user.id,
              role: 'owner',
            },
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatarUrl: true },
              },
            },
          },
        },
      });

      logger.info(
        { projectId: project.id, userId: ctx.user.id, repo: repoMeta.fullName },
        'Project created with GitHub metadata'
      );

      // Auto-start indexing — deduct credits and enqueue job
      const INDEXING_COST = 100;
      if (ctx.user.credits >= INDEXING_COST) {
        await ctx.prisma.$transaction([
          ctx.prisma.user.update({
            where: { id: ctx.user.id },
            data: { credits: { decrement: INDEXING_COST } },
          }),
          ctx.prisma.usageLog.create({
            data: {
              userId: ctx.user.id,
              projectId: project.id,
              action: 'index',
              costCredits: INDEXING_COST,
            },
          }),
          ctx.prisma.project.update({
            where: { id: project.id },
            data: { status: 'indexing' },
          }),
        ]);

        await indexingQueue.add('index-repo', {
          projectId: project.id,
          repoUrl: input.githubUrl,
          userId: ctx.user.id,
          githubPat: input.isPrivate ? input.githubPat : undefined,
        });

        logger.info({ projectId: project.id }, 'Indexing auto-started');
      }

      return project;
    }),

  // Connect GitHub repo to project
  connectGitHub: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        repoUrl: z.string().url().refine((url) => url.startsWith('https://github.com/'), {
          message: 'Must be a GitHub repository URL',
        }),
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

      const updated = await ctx.prisma.project.update({
        where: { id: input.projectId },
        data: {
          githubUrl: input.repoUrl,
          status: 'pending',
        },
      });

      return updated;
    }),

  // Start indexing a project
  startIndexing: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: { some: { userId: ctx.user.id } },
        },
      });

      if (!project || !project.githubUrl) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Project must have a GitHub repo connected before indexing',
        });
      }

      if (project.status === 'indexing') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Project is already being indexed',
        });
      }

      // Check credits
      if (ctx.user.credits < 100) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Insufficient credits (100 required). Please upgrade your plan.',
        });
      }

      // Deduct credits and log usage in a transaction
      await ctx.prisma.$transaction([
        ctx.prisma.user.update({
          where: { id: ctx.user.id },
          data: { credits: { decrement: 100 } },
        }),
        ctx.prisma.usageLog.create({
          data: {
            userId: ctx.user.id,
            projectId: project.id,
            action: 'index',
            costCredits: 100,
          },
        }),
        ctx.prisma.project.update({
          where: { id: input.projectId },
          data: {
            status: 'indexing',
            processedFiles: 0,
            totalFiles: 0,
            indexingError: null,
          },
        }),
      ]);

      // Enqueue background job
      await indexingQueue.add('index-repo', {
        projectId: project.id,
        repoUrl: project.githubUrl,
        userId: ctx.user.id,
        githubPat: project.githubPat || undefined,
      });

      logger.info({ projectId: project.id }, 'Indexing job enqueued');

      return { success: true, message: 'Indexing started' };
    }),

  // Get project details
  get: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: { some: { userId: ctx.user.id } },
        },
        include: {
          files: {
            orderBy: { filePath: 'asc' },
            select: {
              id: true,
              filePath: true,
              fileType: true,
              linesOfCode: true,
              riskLevel: true,
              dependentsCount: true,
              isEntryPoint: true,
            },
          },
          commits: {
            orderBy: { committedAt: 'desc' },
            take: 50,
          },
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatarUrl: true },
              },
            },
          },
          _count: {
            select: { files: true, qaConversations: true, meetings: true },
          },
        },
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      return project;
    }),

  // Get architecture graph
  getArchitecture: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: { some: { userId: ctx.user.id } },
        },
        select: {
          architectureJson: true,
          techStack: true,
          entryPoints: true,
          files: {
            select: {
              id: true,
              filePath: true,
              fileType: true,
              riskLevel: true,
              dependentsCount: true,
              dependenciesCount: true,
              linesOfCode: true,
              isEntryPoint: true,
            },
          },
        },
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return {
        graph: project.architectureJson,
        techStack: project.techStack,
        entryPoints: project.entryPoints,
        files: project.files,
      };
    }),

  // Delete project
  delete: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const project = await ctx.prisma.project.findFirst({
        where: {
          id: input.projectId,
          members: {
            some: { userId: ctx.user.id, role: 'owner' },
          },
        },
      });

      if (!project) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only project owners can delete projects',
        });
      }

      // Delete project (cascade will handle related records)
      await ctx.prisma.project.delete({
        where: { id: input.projectId },
      });

      logger.info({ projectId: input.projectId }, 'Project deleted');

      return { success: true };
    }),

  // Invite member to project
  inviteMember: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        email: z.string().email(),
        role: z.enum(['admin', 'member', 'viewer']).default('member'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify caller is owner or admin
      const membership = await ctx.prisma.userToProject.findFirst({
        where: {
          projectId: input.projectId,
          userId: ctx.user.id,
          role: { in: ['owner', 'admin'] },
        },
      });

      if (!membership) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owners and admins can invite members' });
      }

      // Find user by email
      const invitee = await ctx.prisma.user.findUnique({
        where: { email: input.email },
      });

      if (!invitee) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found. They must sign up first.' });
      }

      // Create membership
      const member = await ctx.prisma.userToProject.create({
        data: {
          userId: invitee.id,
          projectId: input.projectId,
          role: input.role,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      });

      return member;
    }),
});
