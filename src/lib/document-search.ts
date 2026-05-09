// Per-user semantic search over the user's own contracts.
//
// Each Document is split into semantic chunks via the same chunker we use
// for the analyze map-reduce, then each chunk is embedded with Voyage and
// stored in DocumentChunk. Search embeds the query, runs pgvector cosine
// search scoped to the requesting user, and groups matched chunks by
// document.

import { prisma } from "@/lib/db";
import { getEmbedder, isEmbeddingAvailable } from "@/lib/embeddings";
import { chunkContract } from "@/lib/ai/chunking";

const MIN_SIMILARITY = 0.35;
const MAX_CHUNKS_PER_QUERY = 25;
const PREVIEW_CHARS = 240;

export interface DocumentSearchHit {
  documentId: string;
  fileName: string;
  createdAt: Date;
  /** Best similarity across all matched chunks of this doc, in [0, 1]. */
  bestSimilarity: number;
  /** Up to 3 matched fragments with their similarity. */
  fragments: Array<{
    chunkIndex: number;
    similarity: number;
    /** Short excerpt around the chunk content, ~240 chars. */
    preview: string;
  }>;
}

/**
 * Embed all chunks of a document and persist them. Skips silently if the
 * embedder isn't configured. Idempotent — wipes existing chunks for the
 * document first so re-embedding a document doesn't duplicate.
 *
 * Designed to be called fire-and-forget from /api/analyze:
 *   void embedDocumentChunks(doc.id, doc.rawText).catch(...);
 */
export async function embedDocumentChunks(
  documentId: string,
  rawText: string
): Promise<{ embedded: number; tokens: number; skipped?: string }> {
  if (!isEmbeddingAvailable()) {
    return { embedded: 0, tokens: 0, skipped: "embedder not configured" };
  }
  if (!rawText || !rawText.trim()) {
    return { embedded: 0, tokens: 0, skipped: "empty document" };
  }

  // Reuse the existing semantic splitter so chunk boundaries align with how
  // analyze sees the document. Short docs become a single chunk.
  const chunks = chunkContract(rawText);
  if (chunks.length === 0) {
    return { embedded: 0, tokens: 0, skipped: "no chunks produced" };
  }

  const embedder = getEmbedder();
  const inputs = chunks.map((c) => c.text);
  const results = await embedder.embedBatch(inputs, "document");

  // Wipe any prior chunks for this document, then insert fresh ones in a
  // transaction so the embedded set is always internally consistent.
  await prisma.$transaction(async (tx) => {
    await tx.documentChunk.deleteMany({ where: { documentId } });

    for (let i = 0; i < chunks.length; i++) {
      const literal = `[${results[i].vector.join(",")}]`;
      // Two-step insert because Prisma can't write to vector columns: first
      // insert with NULL embedding via Prisma, then UPDATE the vector via
      // raw SQL. The unique constraint (documentId, chunkIndex) makes the
      // pair safe to look up afterwards.
      await tx.documentChunk.create({
        data: {
          documentId,
          chunkIndex: chunks[i].index,
          text: chunks[i].text,
        },
      });
      await tx.$executeRaw`
        UPDATE "DocumentChunk"
        SET "embedding" = ${literal}::vector
        WHERE "documentId" = ${documentId}
          AND "chunkIndex" = ${chunks[i].index}
      `;
    }
  });

  const totalTokens = results.reduce((s, r) => s + r.tokens, 0);
  return { embedded: chunks.length, tokens: totalTokens };
}

/** True if the document already has at least one embedded chunk. */
export async function hasEmbeddings(documentId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM "DocumentChunk"
      WHERE "documentId" = ${documentId}
        AND "embedding" IS NOT NULL
    ) AS exists
  `;
  return Boolean(rows[0]?.exists);
}

/**
 * Semantic search over the user's documents. Returns docs grouped, each with
 * up to 3 best-matching fragments. Strictly scoped to userId — a user can
 * never see chunks from another user's contracts.
 */
export async function searchUserDocuments(
  userId: string,
  query: string,
  topDocs = 8
): Promise<DocumentSearchHit[]> {
  if (!isEmbeddingAvailable()) return [];
  if (!query.trim()) return [];

  const embedder = getEmbedder();
  let queryVec: number[];
  try {
    const result = await embedder.embed(query, "query");
    queryVec = result.vector;
  } catch (e) {
    console.error("[document-search] embed failed:", (e as Error).message);
    return [];
  }
  const literal = `[${queryVec.join(",")}]`;

  // Pull the top N chunks across all of the user's documents, then group
  // client-side. The userId join in WHERE keeps cross-user data invisible
  // even if the index returns noise.
  type ChunkRow = {
    documentId: string;
    chunkIndex: number;
    text: string;
    fileName: string;
    createdAt: Date;
    distance: number;
  };

  const rows = await prisma.$queryRaw<ChunkRow[]>`
    SELECT
      c."documentId",
      c."chunkIndex",
      c."text",
      d."fileName",
      d."createdAt",
      (c."embedding" <=> ${literal}::vector) AS distance
    FROM "DocumentChunk" c
    INNER JOIN "Document" d ON d."id" = c."documentId"
    WHERE d."userId" = ${userId}
      AND c."embedding" IS NOT NULL
    ORDER BY c."embedding" <=> ${literal}::vector
    LIMIT ${MAX_CHUNKS_PER_QUERY}
  `;

  // Group by documentId; keep best similarity + top-3 fragments per doc.
  const byDoc = new Map<string, DocumentSearchHit>();

  for (const row of rows) {
    const similarity = Math.max(0, 1 - row.distance);
    if (similarity < MIN_SIMILARITY) continue;

    const fragment = {
      chunkIndex: row.chunkIndex,
      similarity,
      preview: extractPreview(row.text),
    };

    const existing = byDoc.get(row.documentId);
    if (existing) {
      existing.bestSimilarity = Math.max(existing.bestSimilarity, similarity);
      if (existing.fragments.length < 3) existing.fragments.push(fragment);
    } else {
      byDoc.set(row.documentId, {
        documentId: row.documentId,
        fileName: row.fileName,
        createdAt: row.createdAt,
        bestSimilarity: similarity,
        fragments: [fragment],
      });
    }
  }

  return Array.from(byDoc.values())
    .sort((a, b) => b.bestSimilarity - a.bestSimilarity)
    .slice(0, topDocs);
}

function extractPreview(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= PREVIEW_CHARS) return trimmed;
  return trimmed.slice(0, PREVIEW_CHARS).trimEnd() + "…";
}
