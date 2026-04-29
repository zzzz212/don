import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateDiffSummary } from "@/lib/diff";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { versionId } = body;

    // Get the version to revert to
    const versionToRevert = await prisma.documentVersion.findUnique({
      where: { id: versionId },
    });

    if (!versionToRevert) {
      return NextResponse.json(
        { error: "Version not found" },
        { status: 404 }
      );
    }

    // Get the document
    const doc = await prisma.generatedDocument.findUnique({
      where: { id: versionToRevert.generatedDocId },
    });

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Check authorization
    if (doc.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get the latest version to compare
    const latestVersion = await prisma.documentVersion.findMany({
      where: { generatedDocId: doc.id },
      orderBy: { versionNumber: "desc" },
      take: 1,
    });

    const nextVersionNumber = (latestVersion[0]?.versionNumber || 0) + 1;

    // Generate summary
    const currentContent = latestVersion[0]?.content || doc.content;
    const changesSummary = generateDiffSummary(
      currentContent,
      versionToRevert.content
    );

    // Create new version based on the old one
    const newVersion = await prisma.documentVersion.create({
      data: {
        generatedDocId: doc.id,
        versionNumber: nextVersionNumber,
        title: `Восстановление версии ${versionToRevert.versionNumber}`,
        content: versionToRevert.content,
        formData: versionToRevert.formData ?? {},
        changesSummary: `Восстановлена версия ${versionToRevert.versionNumber}. ${changesSummary}`,
        createdBy: session.user.id,
      },
    });

    return NextResponse.json({ version: newVersion });
  } catch (error) {
    console.error("Revert version error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
