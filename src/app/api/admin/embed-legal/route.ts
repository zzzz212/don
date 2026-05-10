import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEmbedder, isEmbeddingAvailable } from "@/lib/embeddings";
import { reportError } from "@/lib/telemetry";

// Admin-only: batch-embeds every LegalKnowledge row that doesn't yet have an
// embedding. Idempotent — re-running only embeds rows where embedding IS NULL.
// Pass ?force=1 to re-embed everything (use after switching models).
//
// Auth: x-admin-key header must match ADMIN_SEED_KEY env (same convention as
// /api/admin/seed-legal).

const BATCH_SIZE = 32;
const ADMIN_KEY_DEFAULT = "dev-seed-key";

function buildEmbeddingInput(row: {
  code: string;
  title: string;
  shortTitle: string;
  fullText: string;
  commentary: string | null;
  practiceNotes: string | null;
}): string {
  // Combine code + title + body so the embedding captures both metadata and
  // semantic content. Commentary and practice notes add useful context for
  // retrieval — a question about "штраф за просрочку" should hit articles
  // whose practice notes discuss penalties even if the article text doesn't.
  return [
    `${row.code}. ${row.title}`,
    row.shortTitle && row.shortTitle !== row.title ? row.shortTitle : "",
    row.fullText,
    row.commentary ? `Комментарий: ${row.commentary}` : "",
    row.practiceNotes ? `Практика: ${row.practiceNotes}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function POST(request: Request) {
  try {
    const adminKey = request.headers.get("x-admin-key");
    const expectedKey = process.env.ADMIN_SEED_KEY || ADMIN_KEY_DEFAULT;
    if (adminKey !== expectedKey) {
      return NextResponse.json(
        { error: "Unauthorized — invalid admin key" },
        { status: 401 }
      );
    }

    if (!isEmbeddingAvailable()) {
      return NextResponse.json(
        {
          error:
            "No embedding provider configured. Set VOYAGE_API_KEY in env.",
          code: "EMBEDDINGS_NOT_CONFIGURED",
        },
        { status: 503 }
      );
    }

    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "1";

    // Pick rows to embed. With ?force=1 we re-embed everything.
    const rows = force
      ? await prisma.legalKnowledge.findMany({
          select: {
            id: true,
            code: true,
            title: true,
            shortTitle: true,
            fullText: true,
            commentary: true,
            practiceNotes: true,
          },
        })
      : await prisma.$queryRaw<
          Array<{
            id: string;
            code: string;
            title: string;
            shortTitle: string;
            fullText: string;
            commentary: string | null;
            practiceNotes: string | null;
          }>
        >`
          SELECT "id", "code", "title", "shortTitle", "fullText", "commentary", "practiceNotes"
          FROM "LegalKnowledge"
          WHERE "embedding" IS NULL
        `;

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        embedded: 0,
        skipped: "all rows already embedded",
      });
    }

    const embedder = getEmbedder();
    let embedded = 0;
    let totalTokens = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const inputs = batch.map(buildEmbeddingInput);

      try {
        const results = await embedder.embedBatch(inputs, "document");
        // Persist each row's embedding via raw SQL — Prisma doesn't speak
        // pgvector. The literal `[1,2,...]::vector` cast is the canonical
        // pgvector input format.
        for (let j = 0; j < batch.length; j++) {
          const row = batch[j];
          const vec = results[j];
          totalTokens += vec.tokens;
          const literal = `[${vec.vector.join(",")}]`;
          await prisma.$executeRaw`
            UPDATE "LegalKnowledge"
            SET "embedding" = ${literal}::vector
            WHERE "id" = ${row.id}
          `;
          embedded++;
        }
      } catch (e) {
        failed += batch.length;
        await reportError(e, {
          op: "embed-legal.batch",
          extra: { batchStart: i, batchSize: batch.length },
        });
        // Continue with next batch — partial progress is better than none.
      }
    }

    // After backfill, (re)create the IVFFlat index. CREATE INDEX IF NOT EXISTS
    // is safe to run repeatedly. The index can only be created once at least
    // one row has a vector, which is now guaranteed.
    try {
      await prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "LegalKnowledge_embedding_idx" ' +
          'ON "LegalKnowledge" USING ivfflat ("embedding" vector_cosine_ops) ' +
          "WITH (lists = 50)"
      );
    } catch (e) {
      console.error("[embed-legal] index create failed:", e);
    }

    return NextResponse.json({
      success: true,
      embedded,
      failed,
      totalTokens,
      provider: embedder.name,
      dimensions: embedder.dimensions,
    });
  } catch (error) {
    await reportError(error, { op: "embed-legal" });
    // Admin-only endpoint behind x-admin-key auth — safe to surface the
    // actual error so remote curl shows what's wrong.
    return NextResponse.json(
      {
        error: "Не удалось сгенерировать embeddings",
        detail: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
