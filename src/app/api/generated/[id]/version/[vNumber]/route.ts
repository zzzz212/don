import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string; vNumber: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await props.params;
    const { id, vNumber } = params;
    const versionNumber = parseInt(vNumber, 10);

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

    // Get the version
    const version = await prisma.documentVersion.findUnique({
      where: {
        generatedDocId_versionNumber: {
          generatedDocId: id,
          versionNumber,
        },
      },
    });

    if (!version) {
      return NextResponse.json(
        { error: "Version not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ version });
  } catch (error) {
    console.error("Get version error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
