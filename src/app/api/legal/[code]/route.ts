import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  props: { params: Promise<{ code: string }> }
) {
  try {
    const params = await props.params;
    const { code } = params;

    const knowledge = await prisma.legalKnowledge.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        type: true,
        title: true,
        shortTitle: true,
        fullText: true,
        commentary: true,
        practiceNotes: true,
        relatedCodes: true,
        tags: true,
      },
    });

    if (!knowledge) {
      return NextResponse.json(
        { error: "Legal knowledge not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      knowledge: {
        ...knowledge,
        relatedCodes: JSON.parse(knowledge.relatedCodes),
        tags: JSON.parse(knowledge.tags),
      },
    });
  } catch (error) {
    console.error("Legal fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
