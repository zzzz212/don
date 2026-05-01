import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const where = category ? { category } : undefined;

    const templates = await prisma.contractTemplate.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        description: true,
        variables: true,
      },
      orderBy: { category: "asc" },
    });

    // Parse variables JSON
    const templatesWithParsed = templates.map((t) => ({
      ...t,
      variables: JSON.parse(t.variables),
    }));

    // Group by category
    const grouped = templatesWithParsed.reduce(
      (acc, t) => {
        if (!acc[t.category]) {
          acc[t.category] = [];
        }
        acc[t.category].push(t);
        return acc;
      },
      {} as Record<string, typeof templatesWithParsed>
    );

    return NextResponse.json({
      grouped,
      total: templates.length,
    });
  } catch (error) {
    console.error("[Templates] List error:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}
