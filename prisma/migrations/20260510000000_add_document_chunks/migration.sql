-- pgvector should already be enabled by the LegalKnowledge migration; the
-- IF NOT EXISTS keeps this idempotent for fresh DBs.
CREATE EXTENSION IF NOT EXISTS vector;

-- Per-chunk semantic search over the user's own contracts. One row per
-- semantic chunk (typically 3-12 chunks per contract from chunkContract()).
CREATE TABLE "DocumentChunk" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "documentId"  TEXT NOT NULL,
    "chunkIndex"  INTEGER NOT NULL,
    "text"        TEXT NOT NULL,
    "embedding"   vector(1024),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentChunk_documentId_fkey"
      FOREIGN KEY ("documentId") REFERENCES "Document" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DocumentChunk_documentId_chunkIndex_key"
  ON "DocumentChunk"("documentId", "chunkIndex");

CREATE INDEX "DocumentChunk_documentId_idx" ON "DocumentChunk"("documentId");

-- IVFFlat index is only meaningful once at least one row has a vector.
-- The embed-documents admin endpoint creates it after backfill; on a fresh
-- DB it stays absent until then.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "DocumentChunk" WHERE "embedding" IS NOT NULL LIMIT 1
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "DocumentChunk_embedding_idx" '
            'ON "DocumentChunk" USING ivfflat ("embedding" vector_cosine_ops) '
            'WITH (lists = 100)';
  END IF;
END $$;
