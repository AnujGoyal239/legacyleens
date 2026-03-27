// ============================================================
// LegacyLens — Vercel Serverless Entry Point
// Wraps the Fastify app for Vercel's Node.js runtime
// ============================================================

import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { appRouter } from '../src/server/routers/index.js';
import { createContext, getAuthUserFromToken, logger, prisma } from '../src/server/trpc.js';
import { uploadToB2 } from '../src/server/services/storage.js';
import path from 'path';
import { randomUUID } from 'crypto';

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://legacylens.vercel.app';

// Build the Fastify app once (reused across invocations via module cache)
let app: ReturnType<typeof Fastify> | null = null;

async function getApp() {
  if (app) return app;

  app = Fastify({ logger: false });

  await app.register(cors, {
    origin: (origin, cb) => {
      const allowed = [
        FRONTEND_URL,
        'http://localhost:5173',
        'http://localhost:3000',
      ].filter(Boolean);
      if (!origin || allowed.includes(origin)) cb(null, true);
      else cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });

  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  await app.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext,
      onError({ path, error }: { path: string | undefined; error: { message: string } }) {
        logger.error({ path, error: error.message }, 'tRPC error');
      },
    },
  });

  // Health check
  app.get('/api/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  }));

  // Meeting upload
  app.post('/api/meetings/upload', async (request, reply) => {
    try {
      const token =
        request.headers.authorization?.replace(/^Bearer\s+/i, '').trim() ||
        (request.headers['x-access-token'] as string | undefined)?.trim();
      if (!token) return reply.status(401).send({ error: 'Unauthorized' });

      const dbUser = await getAuthUserFromToken(token);
      if (!dbUser) return reply.status(401).send({ error: 'Invalid token' });
      if (dbUser.credits < 10) return reply.status(403).send({ error: 'Insufficient credits (10 required)' });

      let projectId: string | undefined;
      let title = 'Untitled Meeting';
      let fileBuffer: Buffer | null = null;
      let originalFilename: string | undefined;
      let contentType = 'application/octet-stream';

      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'field') {
          if (part.fieldname === 'projectId') projectId = part.value as string;
          if (part.fieldname === 'title') title = (part.value as string) || title;
        } else if (part.type === 'file') {
          originalFilename = part.filename;
          contentType = part.mimetype || contentType;
          const chunks: Buffer[] = [];
          let total = 0;
          for await (const chunk of part.file) {
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            total += buf.length;
            if (total > 50 * 1024 * 1024) return reply.status(413).send({ error: 'File too large.' });
            chunks.push(buf);
          }
          fileBuffer = Buffer.concat(chunks);
        }
      }

      if (!fileBuffer || !originalFilename) return reply.status(400).send({ error: 'No file uploaded.' });
      if (!projectId) return reply.status(400).send({ error: 'projectId is required' });

      const isMember = await prisma.userToProject.findFirst({ where: { projectId, userId: dbUser.id } });
      if (!isMember) return reply.status(403).send({ error: 'Project access denied' });

      const ext = path.extname(originalFilename) || '.mp3';
      const objectKey = `meetings/${projectId}/${randomUUID()}${ext}`;
      const fileUrl = await uploadToB2(fileBuffer, objectKey, contentType);

      const { transcriptionQueue } = await import('../src/server/queues/index.js');

      const [meeting] = await prisma.$transaction([
        prisma.meeting.create({ data: { projectId, title, fileUrl, transcriptionStatus: 'pending' } }),
        prisma.user.update({ where: { id: dbUser.id }, data: { credits: { decrement: 10 } } }),
        prisma.usageLog.create({ data: { userId: dbUser.id, projectId, action: 'meeting', costCredits: 10 } }),
      ]);

      await transcriptionQueue.add('transcribe', { meetingId: meeting.id, fileUrl, projectId });
      return reply.send(meeting);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'internal error';
      logger.error({ error: msg }, 'Meeting upload failed');
      return reply.status(500).send({ error: `Upload failed: ${msg}` });
    }
  });

  // Google OAuth callback
  app.get('/api/google/callback', async (request, reply) => {
    try {
      const { code, state } = request.query as { code?: string; state?: string };
      if (!code) return reply.status(400).send({ error: 'Missing authorization code' });
      if (!state) return reply.status(400).send({ error: 'Missing state parameter' });

      const { exchangeCodeForTokens } = await import('../src/server/services/googleMeet.js');
      const tokens = await exchangeCodeForTokens(code);
      await prisma.user.update({
        where: { id: state },
        data: { googleAccessToken: tokens.access_token ?? null, googleRefreshToken: tokens.refresh_token ?? null },
      });
      return reply.redirect(`${FRONTEND_URL}/dashboard?google=connected`);
    } catch {
      return reply.redirect(`${FRONTEND_URL}/dashboard?google=error`);
    }
  });

  // Stripe webhook
  app.post('/api/webhooks/stripe', async (_request, reply) => {
    reply.send({ received: true });
  });

  await app.ready();
  return app;
}

// Vercel handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const fastify = await getApp();
  await fastify.ready();

  fastify.server.emit('request', req, res);
}
