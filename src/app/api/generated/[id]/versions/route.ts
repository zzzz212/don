import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureActiveOrg } from "@/lib/org";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId =
      session.user.activeOrgId ?? (await ensureActiveOrg(session.user.id));
    const params = await props.params;
    const { id } = params;

    // Workspace-scoped lookup so any member sees the doc's versions.
    const doc = await prisma.generatedDocument.findFirst({
      where: { id, orgId },
      select: { id: true },
    });

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
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
