// ============================================================
// LegacyLens — Worker Entry Point
// Starts all background workers
// ============================================================

import { logger } from '../server/trpc.js';

async function startWorkers() {
  logger.info('Starting LegacyLens workers...');

  // Import workers (they auto-register with BullMQ)
  await import('./indexing.worker.js');
  logger.info('Indexing worker started');

  await import('./transcription.worker.js');
  logger.info('Transcription worker started');

  logger.info('All workers are running. Waiting for jobs...');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down workers...');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startWorkers().catch((error) => {
  logger.error({ error }, 'Failed to start workers');
  process.exit(1);
});
