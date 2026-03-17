// ============================================================
// LegacyLens — Fastify Server Entry Point
// ============================================================

import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { appRouter } from './routers/index.js';
import { createContext, getAuthUserFromToken, logger, prisma } from './trpc.js';
import { transcriptionQueue } from './queues/index.js';
import { uploadToB2 } from './services/storage.js';
import path from 'path';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { randomUUID } from 'crypto';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    maxParamLength: 5000,
    bodyLimit: 55 * 1024 * 1024, // 55 MB — allow large file uploads
  });

  // ============================================================
  // Plugins
  // ============================================================

  // CORS
  await fastify.register(cors, {
    origin: [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  });

  // Rate limiting
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Multipart file uploads (50MB max)
  await fastify.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50 MB
    },
  });

  // Serve uploaded files
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  await fs.mkdir(path.join(uploadsDir, 'meetings'), { recursive: true });
  await fastify.register(fastifyStatic, {
    root: uploadsDir,
    prefix: '/uploads/',
    decorateReply: false,
  });

  // ============================================================
  // tRPC
  // ============================================================

  await fastify.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext,
      onError({ path, error }: { path: string | undefined; error: { message: string } }) {
        logger.error({ path, error: error.message }, 'tRPC error');
      },
    },
  });

  // ============================================================
  // REST Endpoints (non-tRPC)
  // ============================================================

  // Health check
  fastify.get('/api/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
    };
  });

  // Meeting file upload — local file from user's computer
  fastify.post('/api/meetings/upload', async (request, reply) => {
    try {
      const token =
        request.headers.authorization?.replace(/^Bearer\s+/i, '').trim() ||
        (request.headers['x-access-token'] as string | undefined)?.trim();
      if (!token) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const dbUser = await getAuthUserFromToken(token);
      if (!dbUser) {
        return reply.status(401).send({ error: 'Invalid token' });
      }

      if (dbUser.credits < 10) {
        return reply.status(403).send({ error: 'Insufficient credits (10 required)' });
      }

      // Parse multipart form using parts() iterator for reliability
      let projectId: string | undefined;
      let title = 'Untitled Meeting';
      let fileBuffer: Buffer | null = null;
      let originalFilename: string | undefined;
      let contentType = 'application/octet-stream';

      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'field') {
          // Text field
          if (part.fieldname === 'projectId') projectId = part.value as string;
          if (part.fieldname === 'title') title = (part.value as string) || title;
        } else if (part.type === 'file') {
          // File part — collect into a buffer (<= 50 MB)
          originalFilename = part.filename;
          contentType = part.mimetype || contentType;

          const chunks: Buffer[] = [];
          let total = 0;
          for await (const chunk of part.file) {
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            total += buf.length;
            if (total > 50 * 1024 * 1024) {
              return reply
                .status(413)
                .send({ error: 'File too large. Maximum size is 50 MB.' });
            }
            chunks.push(buf);
          }
          fileBuffer = Buffer.concat(chunks);
        }
      }

      if (!fileBuffer || !originalFilename) {
        return reply
          .status(400)
          .send({ error: 'No file uploaded. Please select an audio or video file.' });
      }

      if (!projectId) {
        return reply.status(400).send({ error: 'projectId is required' });
      }

      // Verify project access
      const isMember = await prisma.userToProject.findFirst({
        where: { projectId, userId: dbUser.id },
      });
      if (!isMember) {
        return reply.status(403).send({ error: 'Project access denied' });
      }

      // Upload binary to Backblaze B2
      const ext = path.extname(originalFilename) || '.mp3';
      const objectKey = `meetings/${projectId}/${randomUUID()}${ext}`;
      const fileUrl = await uploadToB2(fileBuffer, objectKey, contentType);

      // Create meeting record and deduct credits
      const [meeting] = await prisma.$transaction([
        prisma.meeting.create({
          data: {
            projectId,
            title,
            fileUrl,
            transcriptionStatus: 'pending',
          },
        }),
        prisma.user.update({
          where: { id: dbUser.id },
          data: { credits: { decrement: 10 } },
        }),
        prisma.usageLog.create({
          data: {
            userId: dbUser.id,
            projectId,
            action: 'meeting',
            costCredits: 10,
          },
        }),
      ]);

      // Enqueue transcription job with the public Firebase URL
      const fullFileUrl = fileUrl;
      await transcriptionQueue.add('transcribe', {
        meetingId: meeting.id,
        fileUrl: fullFileUrl,
        projectId,
      });

      logger.info({ meetingId: meeting.id, objectKey }, 'Meeting file uploaded');

      return reply.send(meeting);
    } catch (error) {
      const errInfo =
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : { value: String(error) };
      logger.error({ error: errInfo }, 'Meeting upload failed');
      return reply
        .status(500)
        .send({ error: `Upload failed: ${errInfo.message || 'internal error'}` });
    }
  });

  // Google OAuth callback — exchanges code for tokens and redirects back to the app
  fastify.get('/api/google/callback', async (request, reply) => {
    try {
      const { code, state } = request.query as { code?: string; state?: string };
      if (!code) {
        return reply.status(400).send({ error: 'Missing authorization code' });
      }
      // state contains the userId set when generating the auth URL
      const userId = state;
      if (!userId) {
        return reply.status(400).send({ error: 'Missing state parameter' });
      }

      const { exchangeCodeForTokens } = await import('./services/googleMeet.js');
      const tokens = await exchangeCodeForTokens(code);

      await prisma.user.update({
        where: { id: userId },
        data: {
          googleAccessToken: tokens.access_token ?? null,
          googleRefreshToken: tokens.refresh_token ?? null,
        },
      });

      logger.info({ userId }, 'Google OAuth connected via callback');

      // Redirect back to the frontend
      return reply.redirect(`${FRONTEND_URL}/dashboard?google=connected`);
    } catch (error) {
      logger.error({ error }, 'Google OAuth callback failed');
      return reply.redirect(`${FRONTEND_URL}/dashboard?google=error`);
    }
  });

  // Stripe webhook (raw body needed)
  fastify.post('/api/webhooks/stripe', async (request, reply) => {
    // Stripe webhook handling is done here because it needs raw body
    // Full implementation in billing service
    reply.send({ received: true });
  });

  // ============================================================
  // Serve frontend in production (Cloud Run serves both API + SPA)
  // ============================================================

  if (process.env.NODE_ENV === 'production') {
    const clientDir = path.resolve(process.cwd(), 'dist/client');
    try {
      await fs.access(clientDir);
      await fastify.register(fastifyStatic, {
        root: clientDir,
        prefix: '/',
        decorateReply: false,
        wildcard: false,
      });
      // SPA fallback: serve index.html for any non-API route
      fastify.setNotFoundHandler(async (_request, reply) => {
        return reply.sendFile('index.html', clientDir);
      });
      logger.info({ dir: clientDir }, 'Serving production frontend');
    } catch {
      logger.info('No dist/client found — frontend not bundled in this build');
    }
  }

  // ============================================================
  // Graceful Shutdown
  // ============================================================

  const shutdown = async () => {
    logger.info('Shutting down gracefully...');
    await fastify.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return fastify;
}

// ============================================================
// Start Server
// ============================================================

async function main() {
  try {
    const server = await buildServer();

    await server.listen({ port: PORT, host: HOST });

    logger.info(`LegacyLens API server running on http://${HOST}:${PORT}`);
    logger.info(`tRPC endpoint: http://${HOST}:${PORT}/trpc`);
    logger.info(`Health check: http://${HOST}:${PORT}/api/health`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

main();

// Export for testing
export { buildServer };
export type { appRouter as AppRouter };
