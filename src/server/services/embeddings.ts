// ============================================================
// LegacyLens — Cohere Embeddings Service
// ============================================================

import { CohereClient } from 'cohere-ai';
import { logger } from '../trpc.js';

// Initialize Cohere client
const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY || '',
});

const BATCH_SIZE = 96; // Cohere max batch size
const EMBEDDING_MODEL = 'embed-english-v3.0';
const EMBEDDING_DIMENSIONS = 1024; // Cohere embed-english-v3.0 outputs 1024 dimensions

/**
 * Generate embeddings for an array of texts
 * Automatically handles batching for large arrays
 */
export async function generateEmbeddings(
  texts: string[],
  inputType: 'search_document' | 'search_query' = 'search_document'
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const allEmbeddings: number[][] = [];

  // Process in batches
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    try {
      const response = await cohere.embed({
        texts: batch,
        model: EMBEDDING_MODEL,
        inputType,
        truncate: 'END',
      });

      if (response.embeddings && Array.isArray(response.embeddings)) {
        allEmbeddings.push(...(response.embeddings as number[][]));
      }

      logger.debug(
        { batchIndex: i / BATCH_SIZE, batchSize: batch.length },
        'Embedding batch completed'
      );
    } catch (error) {
      logger.error({ error, batchIndex: i / BATCH_SIZE }, 'Embedding batch failed');
      // Fill with zero vectors for failed batches
      for (let j = 0; j < batch.length; j++) {
        allEmbeddings.push(new Array(EMBEDDING_DIMENSIONS).fill(0));
      }
    }
  }

  return allEmbeddings;
}

/**
 * Generate a single embedding for a search query
 */
export async function embedQuery(query: string): Promise<number[]> {
  const embeddings = await generateEmbeddings([query], 'search_query');
  return embeddings[0] || new Array(EMBEDDING_DIMENSIONS).fill(0);
}

/**
 * Rerank search results using Cohere's reranker
 */
export async function rerankResults(
  query: string,
  documents: string[],
  topN: number = 5
): Promise<Array<{ index: number; relevanceScore: number }>> {
  if (documents.length === 0) return [];

  try {
    const response = await cohere.rerank({
      query,
      documents,
      model: 'rerank-english-v3.0',
      topN: Math.min(topN, documents.length),
    });

    return response.results.map((r) => ({
      index: r.index,
      relevanceScore: r.relevanceScore,
    }));
  } catch (error) {
    logger.error({ error }, 'Reranking failed');
    // Fallback: return first N results as-is
    return documents.slice(0, topN).map((_, i) => ({
      index: i,
      relevanceScore: 1 - i * 0.1,
    }));
  }
}

export { EMBEDDING_DIMENSIONS };
