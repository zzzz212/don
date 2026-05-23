import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureActiveOrg } from "@/lib/org";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string; vNumber: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId =
      session.user.activeOrgId ?? (await ensureActiveOrg(session.user.id));
    const params = await props.params;
    const { id, vNumber } = params;
    const versionNumber = parseInt(vNumber, 10);

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
