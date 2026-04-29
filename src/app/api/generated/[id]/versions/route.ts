import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
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

    // Get all versions
    const versions = await prisma.documentVersion.findMany({
      where: { generatedDocId: id },
      orderBy: { versionNumber: "asc" },
      select: {
        id: true,
        versionNumber: true,
        title: true,
        changesSummary: true,
        createdAt: true,
        createdBy: true,
        creator: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ versions });
  } catch (error) {
    console.error("Get versions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
