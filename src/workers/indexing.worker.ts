// ============================================================
// LegacyLens — Indexing Worker
// Processes GitHub repo indexing jobs
// ============================================================

import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import {
  cloneRepository,
  getAllFiles,
  getCommitHistory,
  getFileType,
  cleanupTempDir,
} from '../server/services/github.js';
import { parseFileContent } from '../server/services/parser.js';
import { analyzeDependencies } from '../server/services/analyzer.js';
import { generateEmbeddings } from '../server/services/embeddings.js';
import { createProjectCollection, storeVectors } from '../server/services/search.js';
import { redisConnection, type IndexingJobData } from '../server/queues/index.js';
import { logger } from '../server/trpc.js';
import { v4 as uuid } from 'uuid';
import type { ParsedFile } from '../types/index.js';

const prisma = new PrismaClient();

const indexingWorker = new Worker<IndexingJobData>(
  'indexing',
  async (job: Job<IndexingJobData>) => {
    const { projectId, repoUrl, userId, githubPat } = job.data;
    let tempDir: string | null = null;

    logger.info({ projectId, repoUrl }, '[Indexing] Starting');

    try {
      // ============================================================
      // Step 1: Clone Repository
      // ============================================================
      await job.updateProgress(5);
      tempDir = await cloneRepository(repoUrl, projectId, githubPat);

      // ============================================================
      // Step 2: Get All Files
      // ============================================================
      await job.updateProgress(15);
      const repoFiles = await getAllFiles(tempDir);

      await prisma.project.update({
        where: { id: projectId },
        data: { totalFiles: repoFiles.length },
      });

      logger.info({ projectId, fileCount: repoFiles.length }, '[Indexing] Files discovered');

      // ============================================================
      // Step 3: Parse Files
      // ============================================================
      await job.updateProgress(25);
      const parsedFiles: ParsedFile[] = [];

      for (let i = 0; i < repoFiles.length; i++) {
        const file = repoFiles[i];

        try {
          const parsed = parseFileContent(file.path, file.content);

          const parsedFile: ParsedFile = {
            path: file.path,
            content: file.content,
            ...parsed,
          };

          parsedFiles.push(parsedFile);

          // Save file to database
          await prisma.file.create({
            data: {
              projectId,
              filePath: file.path,
              fileType: getFileType(file.path),
              linesOfCode: parsed.linesOfCode,
              functions: JSON.parse(JSON.stringify(parsed.functions)),
              classes: JSON.parse(JSON.stringify(parsed.classes)),
              imports: JSON.parse(JSON.stringify(parsed.imports)),
              exports: JSON.parse(JSON.stringify(parsed.exports)),
            },
          });

          // Update progress
          if (i % 50 === 0) {
            await prisma.project.update({
              where: { id: projectId },
              data: { processedFiles: i + 1 },
            });
            await job.updateProgress(25 + Math.floor((i / repoFiles.length) * 30));
          }
        } catch (error) {
          logger.debug({ filePath: file.path, error }, '[Indexing] Failed to parse file');
        }
      }

      // Final processed count
      await prisma.project.update({
        where: { id: projectId },
        data: { processedFiles: parsedFiles.length },
      });

      // ============================================================
      // Step 4: Analyze Dependencies
      // ============================================================
      await job.updateProgress(60);
      logger.info({ projectId }, '[Indexing] Analyzing dependencies');

      const { graph, entryPoints, techStack } = analyzeDependencies(parsedFiles);

      // Update file risk levels
      for (const node of graph.nodes) {
        try {
          await prisma.file.updateMany({
            where: { projectId, filePath: node.filePath },
            data: {
              riskLevel: node.riskLevel,
              dependentsCount: node.dependentsCount,
              dependenciesCount: node.dependenciesCount,
              isEntryPoint: node.isEntryPoint,
            },
          });
        } catch {
          // Skip files that may have been skipped during parsing
        }
      }

      // ============================================================
      // Step 5: Generate Embeddings
      // ============================================================
      await job.updateProgress(70);
      logger.info({ projectId }, '[Indexing] Generating embeddings');

      // Create Qdrant collection
      await createProjectCollection(projectId);

      // Prepare texts for embedding (file path + content summary)
      const BATCH_SIZE = 96;

      for (let i = 0; i < parsedFiles.length; i += BATCH_SIZE) {
        const batch = parsedFiles.slice(i, i + BATCH_SIZE);
        const texts = batch.map((f) => {
          const summary = [
            `File: ${f.path}`,
            f.functions.length > 0 ? `Functions: ${f.functions.map((fn) => fn.name).join(', ')}` : '',
            f.classes.length > 0 ? `Classes: ${f.classes.map((c) => c.name).join(', ')}` : '',
            f.content.slice(0, 3000),
          ].filter(Boolean).join('\n');
          return summary;
        });

        try {
          const embeddings = await generateEmbeddings(texts);

          const points = batch.map((file, idx) => ({
            id: uuid(),
            vector: embeddings[idx],
            payload: {
              projectId,
              filePath: file.path,
              content: file.content.slice(0, 5000),
              type: 'file',
              functions: file.functions.map((f) => f.name),
              classes: file.classes.map((c) => c.name),
            } as Record<string, unknown>,
          }));

          await storeVectors(projectId, points);
        } catch (error) {
          logger.error({ error, batchStart: i }, '[Indexing] Embedding batch failed');
        }

        await job.updateProgress(70 + Math.floor(((i + BATCH_SIZE) / parsedFiles.length) * 20));
      }

      // ============================================================
      // Step 6: Get Commit History
      // ============================================================
      await job.updateProgress(92);

      try {
        const commits = await getCommitHistory(tempDir, 100);
        for (const commit of commits.slice(0, 50)) {
          await prisma.commit.create({
            data: {
              projectId,
              commitHash: commit.hash,
              message: commit.message,
              author: commit.author,
              authorEmail: commit.authorEmail,
              committedAt: commit.date,
              filesChanged: commit.filesChanged,
            },
          });
        }
      } catch (error) {
        logger.warn({ projectId, error }, '[Indexing] Failed to fetch commits');
      }

      // ============================================================
      // Step 7: Finalize
      // ============================================================
      await job.updateProgress(95);

      await prisma.project.update({
        where: { id: projectId },
        data: {
          status: 'complete',
          architectureJson: JSON.parse(JSON.stringify(graph)),
          techStack: JSON.parse(JSON.stringify(techStack)),
          entryPoints,
          totalLines: parsedFiles.reduce((sum, f) => sum + f.linesOfCode, 0),
          lastSyncedAt: new Date(),
        },
      });

      // ============================================================
      // Step 8: Cleanup
      // ============================================================
      await job.updateProgress(100);

      if (tempDir) {
        await cleanupTempDir(tempDir);
      }

      logger.info(
        { projectId, filesProcessed: parsedFiles.length },
        '[Indexing] Completed successfully'
      );
    } catch (error) {
      logger.error({ error, projectId }, '[Indexing] Failed');

      await prisma.project.update({
        where: { id: projectId },
        data: {
          status: 'failed',
          indexingError: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      if (tempDir) {
        await cleanupTempDir(tempDir);
      }

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 2,
  }
);

indexingWorker.on('completed', (job) => {
  logger.info({ jobId: job?.id }, '[Indexing Worker] Job completed');
});

indexingWorker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, error: error.message }, '[Indexing Worker] Job failed');
});

export { indexingWorker };
