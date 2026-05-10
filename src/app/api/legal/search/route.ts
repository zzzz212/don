import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { vectorSearchLegal } from "@/lib/legal-search";
import { isEmbeddingAvailable } from "@/lib/embeddings";
import { reportError } from "@/lib/telemetry";

// Two search modes:
//   ?mode=keyword  (default)  classic LIKE on title/shortTitle/searchVector/code
//   ?mode=vector              pgvector cosine similarity over LegalKnowledge.embedding
//   ?mode=hybrid              vector first; if it returns nothing, fall back to keyword
//
// Vector mode silently falls back to keyword if embeddings aren't configured
// or if no rows have been embedded yet (so the page never breaks regardless
// of deploy state).

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "10", 10) || 10,
      50
    );
    const mode = (searchParams.get("mode") || "keyword").toLowerCase();

    if (!query || query.length < 2) {
      return NextResponse.json({ error: "Query too short" }, { status: 400 });
    }

    if (mode === "vector" || mode === "hybrid") {
      if (isEmbeddingAvailable()) {
        const hits = await vectorSearchLegal(query, limit);
        if (hits.length > 0) {
          return NextResponse.json({
            mode: "vector",
            results: hits.map((h) => ({
              id: h.id,
              code: h.code,
              type: h.type,
              title: h.title,
              shortTitle: h.shortTitle,
              similarity: Number(h.similarity.toFixed(3)),
            })),
          });
        }
        if (mode === "vector") {
          // Strict vector mode: don't silently fall back to keyword.
          return NextResponse.json({
            mode: "vector",
            results: [],
            note:
              "Семантический поиск не нашёл релевантных статей. Попробуйте переформулировать или включите режим «по словам».",
          });
        }
        // hybrid mode → fall through to keyword
      } else if (mode === "vector") {
        return NextResponse.json({
          mode: "vector",
          results: [],
          note:
            "Семантический поиск не настроен. Используется обычный поиск.",
          fallback: true,
        });
      }
    }

    const results = await prisma.legalKnowledge.findMany({
      where: {
        OR: [
          { title: { contains: query } },
          { shortTitle: { contains: query } },
          { searchVector: { contains: query } },
          { code: { contains: query } },
        ],
      },
      take: limit,
      select: {
        id: true,
        code: true,
        type: true,
        title: true,
        shortTitle: true,
      },
    });

    return NextResponse.json({ mode: "keyword", results });
  } catch (error) {
    await reportError(error, { op: "legal.search" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
