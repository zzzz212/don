-- Enable pgvector. Idempotent — safe if already enabled in Neon SQL editor.
CREATE EXTENSION IF NOT EXISTS vector;

-- Add nullable embedding column to LegalKnowledge.
-- 1024 dimensions matches Voyage AI's voyage-3-large model.
ALTER TABLE "LegalKnowledge" ADD COLUMN "embedding" vector(1024);

-- IVFFlat index for cosine similarity. 'lists' = sqrt(rows) is a typical
-- starting value; the Russian legal corpus is small (hundreds of articles)
-- so 50 lists is plenty. Bigger lists -> faster search, slower build.
-- The index can only be created once at least one row has a vector, so we
-- create it conditionally — first-time bootstrap will skip it; the admin
-- embedding job re-runs CREATE INDEX after backfill.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "LegalKnowledge" WHERE "embedding" IS NOT NULL LIMIT 1
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "LegalKnowledge_embedding_idx" '
            'ON "LegalKnowledge" USING ivfflat ("embedding" vector_cosine_ops) '
            'WITH (lists = 50)';
  END IF;
END $$;
