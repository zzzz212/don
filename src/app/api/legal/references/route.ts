import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const references = await prisma.legalReference.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        knowledge: {
          select: {
            code: true,
            title: true,
            shortTitle: true,
            type: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ references });
  } catch (error) {
    console.error("Get references error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { knownId, note } = body;

    if (!knownId) {
      return NextResponse.json(
        { error: "Missing knownId" },
        { status: 400 }
      );
    }

    // Check if knowledge exists
    const knowledge = await prisma.legalKnowledge.findUnique({
      where: { id: knownId },
    });

    if (!knowledge) {
      return NextResponse.json(
        { error: "Legal knowledge not found" },
        { status: 404 }
      );
    }

    // Create or update reference
    const reference = await prisma.legalReference.upsert({
      where: {
        userId_knownId: {
          userId: session.user.id,
          knownId,
        },
      },
      create: {
        userId: session.user.id,
        knownId,
        note,
      },
      update: {
        note,
      },
    });

    return NextResponse.json({ reference });
  } catch (error) {
    console.error("Save reference error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
