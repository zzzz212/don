import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureActiveOrg } from "@/lib/org";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
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
    // Pull doc.content/name/formData here too — needed for the self-heal
    // path below if the doc was generated before the v1-on-create rule.
    const doc = await prisma.generatedDocument.findFirst({
      where: { id, orgId },
      select: {
        id: true,
        name: true,
        content: true,
        formData: true,
        userId: true,
      },
    });

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    const versionSelect = {
      id: true,
      versionNumber: true,
      title: true,
      changesSummary: true,
      createdAt: true,
      createdBy: true,
      creator: { select: { name: true, email: true } },
    } as const;

    let versions = await prisma.documentVersion.findMany({
      where: { generatedDocId: id },
      orderBy: { versionNumber: "asc" },
      select: versionSelect,
    });

    // Self-heal: documents created before the v1-on-create rule never
    // had a DocumentVersion row, so the versions UI showed "Нет версий"
    // forever. Materialize v1 from the document's current content the
    // first time anyone opens the version page.
    if (versions.length === 0) {
      await prisma.documentVersion.create({
        data: {
          generatedDocId: id,
          versionNumber: 1,
          title: doc.name,
          content: doc.content,
          formData:
            doc.formData && typeof doc.formData === "object"
              ? (doc.formData as Record<string, string>)
              : {},
          changesSummary: "Первоначальная версия (восстановлена)",
          createdBy: doc.userId,
        },
      });
      versions = await prisma.documentVersion.findMany({
        where: { generatedDocId: id },
        orderBy: { versionNumber: "asc" },
        select: versionSelect,
      });
    }

    return NextResponse.json({ versions });
  } catch (error) {
    console.error("Get versions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
