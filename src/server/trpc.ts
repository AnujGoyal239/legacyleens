// ============================================================
// LegacyLens — tRPC Setup & Context (Clerk auth + Neon/Postgres)
// ============================================================

import { initTRPC, TRPCError } from '@trpc/server';
import { type CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { PrismaClient } from '@prisma/client';
import { createClerkClient, verifyToken } from '@clerk/backend';
import superjson from 'superjson';
import pino from 'pino';

// Logger
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

// Prisma Client (singleton)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Clerk (optional client for user lookup; auth is via JWT verify)
const clerkSecretKey = process.env.CLERK_SECRET_KEY;
if (!clerkSecretKey) {
  logger.warn('CLERK_SECRET_KEY not set. Auth will fail. Set it in .env.');
}
export const clerkClient = clerkSecretKey ? createClerkClient({ secretKey: clerkSecretKey }) : null;

// User type from context
export interface UserContext {
  id: string;
  email: string;
  name: string | null;
  credits: number;
  subscriptionTier: string;
  githubUsername: string | null;
  avatarUrl: string | null;
}

// Context type
export interface Context {
  prisma: PrismaClient;
  user: UserContext | null;
  req: CreateFastifyContextOptions['req'];
  res: CreateFastifyContextOptions['res'];
}

// Shared: verify Clerk token and return our DB user (for tRPC context and REST routes)
export async function getAuthUserFromToken(token: string | undefined): Promise<UserContext | null> {
  if (!token?.trim() || !clerkSecretKey) return null;
  const t = token.replace(/^Bearer\s+/i, '').trim();
  if (!t) return null;
  try {
    const payload = await verifyToken(t, { secretKey: clerkSecretKey });
    const clerkId = payload.sub as string;
    if (!clerkId) return null;

    let dbUser = await prisma.user.findUnique({
      where: { clerkId },
      select: {
        id: true,
        email: true,
        name: true,
        credits: true,
        subscriptionTier: true,
        githubUsername: true,
        avatarUrl: true,
      },
    });

    if (!dbUser && clerkClient) {
      const clerkUser = await clerkClient.users.getUser(clerkId);
      const primaryEmail = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;
      const email = primaryEmail ?? `clerk_${clerkId}@legacylens.local`;
      const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null;
      const avatarUrl = clerkUser.imageUrl ?? null;
      dbUser = await prisma.user.create({
        data: { clerkId, email, name, avatarUrl },
        select: {
          id: true,
          email: true,
          name: true,
          credits: true,
          subscriptionTier: true,
          githubUsername: true,
          avatarUrl: true,
        },
      });
      logger.info({ userId: dbUser.id, clerkId }, 'User created from Clerk session');
    } else if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          clerkId,
          email: `clerk_${clerkId}@legacylens.local`,
          name: null,
        },
        select: {
          id: true,
          email: true,
          name: true,
          credits: true,
          subscriptionTier: true,
          githubUsername: true,
          avatarUrl: true,
        },
      });
      logger.info({ userId: dbUser.id, clerkId }, 'User created from Clerk (no API)');
    }
    return dbUser;
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : err }, 'getAuthUserFromToken failed');
    return null;
  }
}

// Create context for each request (Clerk JWT → our DB user)
export async function createContext({ req, res }: CreateFastifyContextOptions): Promise<Context> {
  const authHeader = req.headers.authorization ?? req.headers['authorization'];
  const xToken = req.headers['x-access-token'] as string | undefined;
  const token =
    (typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '').trim() : '') ||
    xToken?.trim();

  if (!token && (req.url?.includes('/trpc') ?? false)) {
    logger.info('tRPC request with no auth token — check client is sending Authorization or x-access-token');
  }

  const user = await getAuthUserFromToken(token);

  return {
    prisma,
    user,
    req,
    res,
  };
}

// Initialize tRPC
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof Error ? error.cause.message : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

const isAuthenticated = middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthenticated);
