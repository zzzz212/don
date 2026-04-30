import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: "Query too short" },
        { status: 400 }
      );
    }

    // Search in title, shortTitle, and searchVector
    // Note: SQLite's default string comparison is case-insensitive, so no need for mode
    const results = await prisma.legalKnowledge.findMany({
      where: {
        OR: [
          {
            title: {
              contains: query,
            },
          },
          {
            shortTitle: {
              contains: query,
            },
          },
          {
            searchVector: {
              contains: query,
            },
          },
          {
            code: {
              contains: query,
            },
          },
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

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Legal search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
