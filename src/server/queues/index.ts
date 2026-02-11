// ============================================================
// LegacyLens — BullMQ Queue Setup
// ============================================================

import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../trpc.js';

// Redis connection for BullMQ
export const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

redisConnection.on('connect', () => {
  logger.info('Redis connected (BullMQ)');
});

redisConnection.on('error', (err) => {
  logger.error({ error: err.message }, 'Redis connection error');
});

// Job options shared across queues
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000, // 2s, 4s, 8s
  },
  removeOnComplete: true,
  removeOnFail: false,
};

// ============================================================
// Queue Definitions
// ============================================================

// Indexing Queue — processes GitHub repo indexing
export const indexingQueue = new Queue('indexing', {
  connection: redisConnection,
  defaultJobOptions,
});

// Transcription Queue — processes meeting audio/video
export const transcriptionQueue = new Queue('transcription', {
  connection: redisConnection,
  defaultJobOptions,
});

// Embedding Queue — batch embedding generation
export const embeddingQueue = new Queue('embedding', {
  connection: redisConnection,
  defaultJobOptions,
});

// Job data types
export interface IndexingJobData {
  projectId: string;
  repoUrl: string;
  userId: string;
  githubPat?: string;
}

export interface TranscriptionJobData {
  meetingId: string;
  fileUrl: string;
  projectId: string;
}

export interface EmbeddingJobData {
  texts: string[];
  projectId: string;
  metadata: Array<{
    filePath?: string;
    type: 'file' | 'function' | 'class' | 'meeting_chunk';
  }>;
}

logger.info('BullMQ queues initialized');
