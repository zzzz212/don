import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateDiffSummary } from "@/lib/diff";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await props.params;
    const { id } = params;
    const body = await request.json();
    const { title, content, formData } = body;

    // Get the document
    const doc = await prisma.generatedDocument.findUnique({
      where: { id },
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

    // Get the next version number
    const lastVersion = await prisma.documentVersion.findMany({
      where: { generatedDocId: id },
      orderBy: { versionNumber: "desc" },
      take: 1,
    });

    const nextVersionNumber = (lastVersion[0]?.versionNumber || 0) + 1;

    // Generate summary of changes
    const changesSummary = generateDiffSummary(doc.content, content);

    // Create new version
    const version = await prisma.documentVersion.create({
      data: {
        generatedDocId: id,
        versionNumber: nextVersionNumber,
        title: title || `v${nextVersionNumber}`,
        content,
        formData: formData || doc.formData,
        changesSummary,
        createdBy: session.user.id,
      },
    });

    return NextResponse.json({ version });
  } catch (error) {
    console.error("Create version error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
