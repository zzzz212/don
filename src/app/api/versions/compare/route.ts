import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeDiff } from "@/lib/diff";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { v1Id, v2Id } = body;

    // Get both versions
    const [v1, v2] = await Promise.all([
      prisma.documentVersion.findUnique({
        where: { id: v1Id },
      }),
      prisma.documentVersion.findUnique({
        where: { id: v2Id },
      }),
    ]);

    if (!v1 || !v2) {
      return NextResponse.json(
        { error: "One or both versions not found" },
        { status: 404 }
      );
    }

    // Check authorization - both versions must belong to user's documents
    const [doc1, doc2] = await Promise.all([
      prisma.generatedDocument.findUnique({
        where: { id: v1.generatedDocId },
      }),
      prisma.generatedDocument.findUnique({
        where: { id: v2.generatedDocId },
      }),
    ]);

    if (!doc1 || !doc2 || doc1.userId !== session.user.id || doc2.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Compute diff
    const diffResult = computeDiff(v1.content, v2.content);

    return NextResponse.json({
      v1: {
        id: v1.id,
        versionNumber: v1.versionNumber,
        title: v1.title,
      },
      v2: {
        id: v2.id,
        versionNumber: v2.versionNumber,
        title: v2.title,
      },
      diff: diffResult,
    });
  } catch (error) {
    console.error("Compare versions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
