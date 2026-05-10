import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateDiffSummary } from "@/lib/diff";
import { ensureActiveOrg } from "@/lib/org";
import { NextResponse } from "next/server";

export async function POST(
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
    const body = await request.json();
    const { title, content, formData } = body as {
      title?: string;
      content?: string;
      formData?: Record<string, unknown>;
    };

    if (typeof content !== "string" || content.length < 100) {
      return NextResponse.json(
        { error: "Содержимое новой версии пустое или слишком короткое" },
        { status: 400 }
      );
    }

    // Workspace-scoped: any member of the org can create a new version.
    const doc = await prisma.generatedDocument.findFirst({
      where: { id, orgId },
    });

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Sanitize formData to a plain string-string record before Prisma —
    // its Json scalar wants InputJsonValue, and our templates only ever
    // collect string fields.
    const safeFormData: Record<string, string> = {};
    if (formData && typeof formData === "object") {
      for (const [k, v] of Object.entries(formData)) {
        if (typeof v === "string") safeFormData[k] = v;
        else if (typeof v === "number" || typeof v === "boolean") {
          safeFormData[k] = String(v);
        }
      }
    }

    // Diff summary is computed against the current document content,
    // which is the latest-version content (kept in sync via this same
    // endpoint and the revert endpoint).
    const changesSummary = generateDiffSummary(doc.content, content);

    // Atomic: increment version + persist version + denormalize new
    // content/formData onto the parent document so /generated/[id]
    // always renders the latest version without an extra join.
    const version = await prisma.$transaction(async (tx) => {
      const lastVersion = await tx.documentVersion.findFirst({
        where: { generatedDocId: id },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });
      const nextVersionNumber = (lastVersion?.versionNumber ?? 0) + 1;

      const created = await tx.documentVersion.create({
        data: {
          generatedDocId: id,
          versionNumber: nextVersionNumber,
          title:
            (title && title.trim().length > 0
              ? title.trim()
              : `Версия ${nextVersionNumber}`),
          content,
          formData: safeFormData,
          changesSummary,
          createdBy: session.user.id,
        },
      });

      await tx.generatedDocument.update({
        where: { id },
        data: { content, formData: safeFormData },
      });

      return created;
    });

    return NextResponse.json({ version, documentId: id });
  } catch (error) {
    console.error("Create version error:", error);
    return NextResponse.json(
      { error: "Не удалось создать версию документа" },
      { status: 500 }
    );
  }
}
