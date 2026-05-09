import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { searchUserDocuments } from "@/lib/document-search";
import { isEmbeddingAvailable } from "@/lib/embeddings";
import { reportError } from "@/lib/telemetry";

// GET /api/documents/search?q=... — semantic search across the requesting
// user's contracts. Falls back to a fileName / Analysis.summary keyword
// match when embeddings aren't configured or the user's docs aren't
// embedded yet.
//
// Strictly auth-scoped: WHERE userId = me everywhere, no cross-user reads.

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") || "").trim();
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "8", 10) || 8,
      30
    );

    if (query.length < 2) {
      return NextResponse.json({
        mode: "keyword",
        results: [],
        note: "Введите минимум 2 символа",
      });
    }

    // Try semantic first when embeddings are configured.
    if (isEmbeddingAvailable()) {
      const hits = await searchUserDocuments(userId, query, limit);
      if (hits.length > 0) {
        return NextResponse.json({
          mode: "semantic",
          results: hits.map((h) => ({
            documentId: h.documentId,
            fileName: h.fileName,
            createdAt: h.createdAt,
            similarity: Number(h.bestSimilarity.toFixed(3)),
            fragments: h.fragments.map((f) => ({
              chunkIndex: f.chunkIndex,
              similarity: Number(f.similarity.toFixed(3)),
              preview: f.preview,
            })),
          })),
        });
      }
      // Fall through to keyword if semantic returned no hits — useful
      // when only the most recent uploads are embedded.
    }

    // Keyword fallback: case-insensitive contains on fileName and the
    // analysis summary. Cheap, scoped to the user, useful when semantic
    // isn't available or didn't match.
    const docs = await prisma.document.findMany({
      where: {
        userId,
        OR: [
          { fileName: { contains: query, mode: "insensitive" } },
          { analysis: { summary: { contains: query, mode: "insensitive" } } },
        ],
      },
      include: { analysis: { select: { summary: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      mode: "keyword",
      results: docs.map((d) => ({
        documentId: d.id,
        fileName: d.fileName,
        createdAt: d.createdAt,
        similarity: null,
        fragments: d.analysis?.summary
          ? [
              {
                chunkIndex: -1,
                similarity: null,
                preview: d.analysis.summary.slice(0, 240),
              },
            ]
          : [],
      })),
      note: !isEmbeddingAvailable()
        ? "Семантический поиск не настроен. Используется поиск по названию и саммари."
        : undefined,
    });
  } catch (error) {
    await reportError(error, { op: "documents.search" });
    return NextResponse.json(
      { error: "Ошибка поиска" },
      { status: 500 }
    );
  }
}
