import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  props: { params: Promise<{ code: string }> }
) {
  try {
    const params = await props.params;
    const { code } = params;

    // Get the knowledge entry
    const knowledge = await prisma.legalKnowledge.findUnique({
      where: { code },
    });

    if (!knowledge) {
      return NextResponse.json(
        { error: "Legal knowledge not found" },
        { status: 404 }
      );
    }

    // Parse related codes
    const relatedCodes = JSON.parse(knowledge.relatedCodes);

    // Fetch all related items
    const related = await prisma.legalKnowledge.findMany({
      where: {
        code: {
          in: relatedCodes,
        },
      },
      select: {
        id: true,
        code: true,
        type: true,
        title: true,
        shortTitle: true,
      },
    });

    return NextResponse.json({ related });
  } catch (error) {
    console.error("Related legal fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
