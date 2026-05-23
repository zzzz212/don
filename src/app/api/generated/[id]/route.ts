import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureActiveOrg } from "@/lib/org";
import { reportError } from "@/lib/telemetry";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId =
      session.user.activeOrgId ?? (await ensureActiveOrg(session.user.id));
    const { id } = await params;

    // Workspace-scoped: any member can read documents owned by the org.
    const doc = await prisma.generatedDocument.findFirst({
      where: { id, orgId },
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json(doc);
  } catch (error) {
    console.error("Error fetching document:", error);
    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 }
    );
  }
}

// PATCH /api/generated/[id]  { name }
//   Rename the document (the title shown on /generated/[id] and the
//   dashboard list). Any workspace member may rename — same surface as
//   reading the doc, no role gate. Other fields aren't editable here;
//   content edits go through /create-version (audited).
const PatchSchema = z.object({
  name: z.string().trim().min(1, "Минимум 1 символ").max(200, "Максимум 200 символов"),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId =
      session.user.activeOrgId ?? (await ensureActiveOrg(session.user.id));
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Неверные данные" },
        { status: 400 }
      );
    }

    const doc = await prisma.generatedDocument.findFirst({
      where: { id, orgId },
      select: { id: true },
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const updated = await prisma.generatedDocument.update({
      where: { id: doc.id },
      data: { name: parsed.data.name },
      select: { id: true, name: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    await reportError(error, { op: "generated.patch" });
    return NextResponse.json(
      { error: "Не удалось сохранить" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId =
      session.user.activeOrgId ?? (await ensureActiveOrg(session.user.id));
    const { id } = await params;

    const doc = await prisma.generatedDocument.findFirst({
      where: { id, orgId },
      select: { id: true },
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    await prisma.generatedDocument.delete({
      where: { id: doc.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
