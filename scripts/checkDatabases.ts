// Simple health check script for LegacyLens data stores
// Run with: npx tsx scripts/checkDatabases.ts
// Storage: PostgreSQL (all data + pgvector embeddings); Redis (metadata only: BullMQ, rate limits, sessions)

import { prisma, logger } from '../src/server/trpc.js';
import { redisConnection } from '../src/server/queues/index.js';
import { uploadToFirebase } from '../src/server/services/storage.js';

async function checkPostgres() {
  const result = await prisma.$queryRawUnsafe('SELECT 1 as ok');
  logger.info({ result }, 'Postgres health check OK');
}

async function checkPgVector() {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') as exists"
  );
  logger.info({ pgvector: rows[0]?.exists ?? false }, 'pgvector extension check OK');
}

async function checkRedis() {
  const pong = await redisConnection.ping();
  logger.info({ pong }, 'Redis health check OK (metadata: BullMQ, rate limits, sessions)');
}

async function checkFirebaseStorage() {
  const now = Date.now();
  const buf = Buffer.from(`healthcheck-${now}`, 'utf8');
  const url = await uploadToFirebase(buf, `healthchecks/${now}.txt`, 'text/plain');
  logger.info({ url }, 'Firebase Storage health check OK');
}

async function main() {
  try {
    await checkPostgres();
    await checkPgVector();
    await checkRedis();
    await checkFirebaseStorage();
    logger.info('All data store health checks completed successfully');
  } catch (error) {
    logger.error({ error }, 'One or more data store health checks FAILED');
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await redisConnection.quit();
  }
}

main().catch((error) => {
  logger.error({ error }, 'Unexpected error running data store health checks');
  process.exit(1);
});

