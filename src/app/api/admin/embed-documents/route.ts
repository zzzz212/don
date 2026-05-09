import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isEmbeddingAvailable } from "@/lib/embeddings";
import { embedDocumentChunks } from "@/lib/document-search";
import { reportError } from "@/lib/telemetry";

// Admin-only: backfills DocumentChunk embeddings for every Document that
// doesn't yet have any. Idempotent. Run once after enabling Voyage to
// retroactively make every existing user's archive searchable.
//
// Auth: x-admin-key header must match ADMIN_SEED_KEY env (matches the
// existing /api/admin/seed-legal and /api/admin/embed-legal convention).
//
// Query params:
//   ?force=1           re-embed all docs, even those already embedded
//   ?userId=<cuid>     only that user's docs
//   ?limit=<n>         cap how many docs to process this run (default 200)

const ADMIN_KEY_DEFAULT = "dev-seed-key";
const DEFAULT_LIMIT = 200;

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
    const userId = url.searchParams.get("userId") || undefined;
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || String(DEFAULT_LIMIT), 10) ||
        DEFAULT_LIMIT,
      1000
    );

    // Pick documents to process. The `WHERE NOT EXISTS` correlated subquery
    // skips docs that already have at least one embedded chunk; with ?force=1
    // we drop that filter.
    //
    // SQL fragments are composed with Prisma.sql / Prisma.empty — calling
    // prisma.$queryRaw inside an interpolation would execute that fragment
    // as its own (broken) query and return a Promise, not a fragment.
    type Row = { id: string; rawText: string };
    const userFilter = userId
      ? Prisma.sql`d."userId" = ${userId} AND `
      : Prisma.empty;

    const rows = force
      ? await prisma.document.findMany({
          where: userId ? { userId } : undefined,
          select: { id: true, rawText: true },
          take: limit,
          orderBy: { createdAt: "desc" },
        })
      : await prisma.$queryRaw<Row[]>`
          SELECT d."id", d."rawText"
          FROM "Document" d
          WHERE ${userFilter}
                NOT EXISTS (
                  SELECT 1 FROM "DocumentChunk" c
                  WHERE c."documentId" = d."id"
                    AND c."embedding" IS NOT NULL
                )
          ORDER BY d."createdAt" DESC
          LIMIT ${limit}
        `;

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        embedded: 0,
        skipped: "no documents need embedding",
      });
    }

    let embeddedDocs = 0;
    let totalChunks = 0;
    let totalTokens = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const result = await embedDocumentChunks(row.id, row.rawText);
        if (result.embedded > 0) {
          embeddedDocs++;
          totalChunks += result.embedded;
          totalTokens += result.tokens;
        }
      } catch (e) {
        failed++;
        await reportError(e, {
          op: "embed-documents.row",
          extra: { documentId: row.id },
        });
        // Continue with the rest — partial progress is better than none.
      }
    }

    // Build / refresh the IVFFlat index now that there are vectors. Safe to
    // run repeatedly thanks to IF NOT EXISTS.
    try {
      await prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "DocumentChunk_embedding_idx" ' +
          'ON "DocumentChunk" USING ivfflat ("embedding" vector_cosine_ops) ' +
          "WITH (lists = 100)"
      );
    } catch (e) {
      console.error("[embed-documents] index create failed:", e);
    }

    return NextResponse.json({
      success: true,
      processed: rows.length,
      embeddedDocs,
      totalChunks,
      totalTokens,
      failed,
    });
  } catch (error) {
    await reportError(error, { op: "embed-documents" });
    // This is an admin-only endpoint behind x-admin-key auth, so it's safe
    // to surface the actual error message to make remote debugging painless.
    return NextResponse.json(
      {
        error: "Не удалось сгенерировать embeddings",
        detail: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
