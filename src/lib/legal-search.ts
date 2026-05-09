// Vector search over LegalKnowledge using pgvector. Goes through raw SQL
// because Prisma can't represent the `vector` type natively.
//
// The cosine-distance operator `<=>` returns 0 (identical) → 2 (opposite).
// Lower is better. We expose distance as 1 - similarity so the caller can
// reason in [0, 1] terms (1.0 = perfect match).

import { prisma } from "@/lib/db";
import { getEmbedder, isEmbeddingAvailable } from "@/lib/embeddings";

export interface VectorHit {
  id: string;
  code: string;
  type: string;
  title: string;
  shortTitle: string;
  fullText: string;
  commentary: string | null;
  practiceNotes: string | null;
  /** Cosine similarity in [0, 1]; 1 = perfect match. */
  similarity: number;
}

/** Minimum similarity below which results are dropped as noise. */
export const MIN_SIMILARITY = 0.45;

/**
 * Embed the query and return top-k LegalKnowledge rows by cosine similarity.
 * Returns [] if embeddings are not configured or if no rows have embeddings yet.
 */
export async function vectorSearchLegal(
  query: string,
  k = 5
): Promise<VectorHit[]> {
  if (!isEmbeddingAvailable()) return [];
  if (!query.trim()) return [];

  const embedder = getEmbedder();
  let queryVec: number[];
  try {
    const result = await embedder.embed(query, "query");
    queryVec = result.vector;
  } catch (e) {
    console.error("[legal-search] embed failed:", (e as Error).message);
    return [];
  }

  // pgvector accepts the literal `[1.2,3.4,...]` syntax for vector params.
  // We pass it as a string and cast on the SQL side. Using $queryRaw with
  // ::vector cast keeps the query plan unchanged across calls.
  const literal = `[${queryVec.join(",")}]`;

  type Row = {
    id: string;
    code: string;
    type: string;
    title: string;
    shortTitle: string;
    fullText: string;
    commentary: string | null;
    practiceNotes: string | null;
    distance: number;
  };

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT
      "id", "code", "type", "title", "shortTitle", "fullText",
      "commentary", "practiceNotes",
      ("embedding" <=> ${literal}::vector) AS distance
    FROM "LegalKnowledge"
    WHERE "embedding" IS NOT NULL
    ORDER BY "embedding" <=> ${literal}::vector
    LIMIT ${k}
  `;

  return rows
    .map((r) => ({
      id: r.id,
      code: r.code,
      type: r.type,
      title: r.title,
      shortTitle: r.shortTitle,
      fullText: r.fullText,
      commentary: r.commentary,
      practiceNotes: r.practiceNotes,
      // Cosine distance in [0, 2]; convert to similarity in [-1, 1] then
      // clamp negative to 0 so the public scale is intuitive.
      similarity: Math.max(0, 1 - r.distance),
    }))
    .filter((r) => r.similarity >= MIN_SIMILARITY);
}

/** How many LegalKnowledge rows currently have an embedding. */
export async function countEmbeddedLegal(): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "LegalKnowledge"
    WHERE "embedding" IS NOT NULL
  `;
  return Number(rows[0]?.count ?? 0);
}
