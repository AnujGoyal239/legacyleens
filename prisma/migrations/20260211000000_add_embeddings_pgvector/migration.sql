-- Enable pgvector extension (required for vector similarity search)
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable: embeddings (all vectors stored in PostgreSQL; Redis is metadata-only)
CREATE TABLE "embeddings" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "file_path" TEXT,
    "content" TEXT,
    "file_id" TEXT,
    "meeting_id" TEXT,
    "timestamp_start" DOUBLE PRECISION,
    "timestamp_end" DOUBLE PRECISION,
    "embedding" vector(1024),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "embeddings_pkey" PRIMARY KEY ("id")
);

-- Foreign key
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes for filtering and vector similarity search
CREATE INDEX "embeddings_project_id_idx" ON "embeddings"("project_id");
CREATE INDEX "embeddings_type_idx" ON "embeddings"("type");

-- HNSW index for fast approximate nearest neighbor search (cosine distance)
CREATE INDEX "embeddings_embedding_idx" ON "embeddings" USING hnsw ("embedding" vector_cosine_ops);
