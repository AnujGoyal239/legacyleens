// ============================================================
// LegacyLens — Vector Search Service (PostgreSQL + pgvector)
// All embeddings and search are stored in PostgreSQL.
// ============================================================

import { embedQuery, rerankResults } from './embeddings.js';
import { prisma, logger } from '../trpc.js';
import type { SearchResult } from '../../types/index.js';

const SEARCH_LIMIT = 20;
const SCORE_THRESHOLD = 0.5;

/**
 * No-op for PostgreSQL: we use a single embeddings table keyed by project_id.
 * Kept for API compatibility with workers.
 */
export async function createProjectCollection(_projectId: string): Promise<void> {
  // All data lives in PostgreSQL; no separate "collection" to create
  logger.debug('PostgreSQL embeddings table used (no collection creation needed)');
}

/**
 * Format a float array as pgvector literal for raw SQL
 */
function toVectorLiteral(vector: number[]): string {
  return '[' + vector.join(',') + ']';
}

/**
 * Store vectors in PostgreSQL (embeddings table)
 */
export async function storeVectors(
  projectId: string,
  points: Array<{
    id: string;
    vector: number[];
    payload: Record<string, unknown>;
  }>
): Promise<void> {
  if (points.length === 0) return;

  for (const p of points) {
    const type = (p.payload?.type as string) || 'file';
    const filePath = (p.payload?.filePath ?? p.payload?.file_path) as string | undefined;
    const content = (p.payload?.content as string) ?? '';
    const meetingId = p.payload?.meetingId as string | undefined;
    const timestampStart = p.payload?.timestampStart as number | undefined;
    const timestampEnd = p.payload?.timestampEnd as number | undefined;

    const vectorLiteral = toVectorLiteral(p.vector);

    await prisma.$executeRawUnsafe(
      `INSERT INTO embeddings (id, project_id, type, file_path, content, meeting_id, timestamp_start, timestamp_end, embedding)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector)`,
      p.id,
      projectId,
      type,
      filePath ?? null,
      content.slice(0, 5000),
      meetingId ?? null,
      timestampStart ?? null,
      timestampEnd ?? null,
      vectorLiteral
    );
  }

  logger.debug({ projectId, count: points.length }, 'Vectors stored in PostgreSQL');
}

/**
 * Search for relevant code given a natural language query
 * Full RAG retrieval: Embed → pgvector similarity search → Rerank
 */
export async function searchCode(
  query: string,
  projectId: string,
  topK: number = 5
): Promise<SearchResult[]> {
  try {
    // 1. Embed the query
    const queryVector = await embedQuery(query);
    const queryVectorLiteral = toVectorLiteral(queryVector);

    // 2. Similarity search in PostgreSQL (cosine distance <=>)
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        file_path: string | null;
        content: string | null;
        type: string;
        score: number;
      }>
    >(
      `SELECT file_path, content, type,
              1 - (embedding <=> $1::vector) AS score
       FROM embeddings
       WHERE project_id = $2
         AND (1 - (embedding <=> $1::vector)) >= $3
       ORDER BY embedding <=> $1::vector
       LIMIT $4`,
      queryVectorLiteral,
      projectId,
      SCORE_THRESHOLD,
      SEARCH_LIMIT
    );

    if (rows.length === 0) {
      logger.info({ projectId, query }, 'No search results found');
      return [];
    }

    // 3. Rerank with Cohere for better precision
    const documents = rows.map((r) => (r.content ?? '').trim() || (r.file_path ?? ''));
    const reranked = await rerankResults(query, documents, topK);

    const results: SearchResult[] = reranked.map((r) => {
      const original = rows[r.index];
      return {
        filePath: (original?.file_path ?? 'unknown').trim(),
        content: (original?.content ?? '').trim(),
        score: r.relevanceScore,
        type: (original?.type === 'meeting_chunk' ? 'meeting' : 'code') as 'code' | 'meeting',
        metadata: original as unknown as Record<string, unknown>,
      };
    });

    logger.info(
      { projectId, query, resultsCount: results.length },
      'Code search completed (PostgreSQL)'
    );

    return results;
  } catch (error) {
    logger.error({ error, projectId, query }, 'Code search failed');
    return [];
  }
}

/**
 * Delete all embeddings for a project (called when project is deleted)
 */
export async function deleteProjectCollection(projectId: string): Promise<void> {
  try {
    await prisma.embedding.deleteMany({
      where: { projectId },
    });
    logger.info({ projectId }, 'Project embeddings deleted from PostgreSQL');
  } catch (error) {
    logger.warn({ projectId, error }, 'Failed to delete project embeddings');
  }
}
