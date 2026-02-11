// ============================================================
// LegacyLens — Transcription Worker
// Processes meeting audio transcription jobs
// ============================================================

import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { transcribeAudio, extractMeetingInsights } from '../server/services/llm.js';
import { generateEmbeddings } from '../server/services/embeddings.js';
import { storeVectors } from '../server/services/search.js';
import { downloadFromFirebase } from '../server/services/storage.js';
import { redisConnection, type TranscriptionJobData } from '../server/queues/index.js';
import { logger } from '../server/trpc.js';
import { v4 as uuid } from 'uuid';

const prisma = new PrismaClient();

const transcriptionWorker = new Worker<TranscriptionJobData>(
  'transcription',
  async (job: Job<TranscriptionJobData>) => {
    const { meetingId, fileUrl, projectId } = job.data;

    logger.info({ meetingId }, '[Transcription] Starting');

    try {
      // Update status
      await prisma.meeting.update({
        where: { id: meetingId },
        data: { transcriptionStatus: 'processing' },
      });

      // ============================================================
      // Step 1: Download audio file
      // ============================================================
      await job.updateProgress(10);
      const audioBuffer = await downloadFromFirebase(fileUrl);

      // ============================================================
      // Step 2: Transcribe audio
      // ============================================================
      await job.updateProgress(30);
      logger.info({ meetingId }, '[Transcription] Calling Groq Whisper');
      const segments = await transcribeAudio(audioBuffer);

      const fullTranscript = segments.map((s) => s.text).join(' ');

      // ============================================================
      // Step 3: Extract insights
      // ============================================================
      await job.updateProgress(50);
      logger.info({ meetingId }, '[Transcription] Extracting insights');
      const insights = await extractMeetingInsights(fullTranscript);

      // ============================================================
      // Step 4: Chunk transcript & generate embeddings
      // ============================================================
      await job.updateProgress(70);
      const chunks = chunkTranscript(segments, 500);

      if (chunks.length > 0) {
        const chunkTexts = chunks.map((c) => c.text);
        const embeddings = await generateEmbeddings(chunkTexts);

        // Store embeddings in Qdrant
        const points = chunks.map((chunk, idx) => ({
          id: uuid(),
          vector: embeddings[idx],
          payload: {
            meetingId,
            projectId,
            text: chunk.text,
            timestampStart: chunk.start,
            timestampEnd: chunk.end,
            type: 'meeting_chunk',
          } as Record<string, unknown>,
        }));

        await storeVectors(projectId, points);
      }

      // ============================================================
      // Step 5: Save to database
      // ============================================================
      await job.updateProgress(90);

      const lastSegment = segments[segments.length - 1];

      await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          transcriptionStatus: 'complete',
          transcriptText: fullTranscript,
          insights: JSON.parse(JSON.stringify(insights)),
          durationSeconds: lastSegment ? Math.ceil(lastSegment.end) : 0,
        },
      });

      await job.updateProgress(100);
      logger.info({ meetingId }, '[Transcription] Completed successfully');
    } catch (error) {
      logger.error({ error, meetingId }, '[Transcription] Failed');

      await prisma.meeting.update({
        where: { id: meetingId },
        data: { transcriptionStatus: 'failed' },
      });

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 3,
  }
);

/**
 * Split transcript segments into chunks of approximately N words
 */
function chunkTranscript(
  segments: Array<{ text: string; start: number; end: number }>,
  maxWords: number
): Array<{ text: string; start: number; end: number }> {
  const chunks: Array<{ text: string; start: number; end: number }> = [];
  let currentChunk = { text: '', start: 0, end: 0 };
  let wordCount = 0;

  for (const segment of segments) {
    const words = segment.text.split(/\s+/).length;

    if (wordCount + words > maxWords && currentChunk.text) {
      chunks.push({ ...currentChunk });
      currentChunk = { text: '', start: segment.start, end: segment.end };
      wordCount = 0;
    }

    if (!currentChunk.text) {
      currentChunk.start = segment.start;
    }

    currentChunk.text += ' ' + segment.text;
    currentChunk.end = segment.end;
    wordCount += words;
  }

  if (currentChunk.text.trim()) {
    chunks.push(currentChunk);
  }

  return chunks;
}

transcriptionWorker.on('completed', (job) => {
  logger.info({ jobId: job?.id }, '[Transcription Worker] Job completed');
});

transcriptionWorker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, error: error.message }, '[Transcription Worker] Job failed');
});

export { transcriptionWorker };
