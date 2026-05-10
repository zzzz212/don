import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateDiffSummary } from "@/lib/diff";
import {
  ensureActiveOrg,
  requireMembership,
  OrgAccessError,
} from "@/lib/org";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { versionId } = body as { versionId?: string };
    if (typeof versionId !== "string" || !versionId) {
      return NextResponse.json(
        { error: "versionId обязателен" },
        { status: 400 }
      );
    }

    // Look up the version and its parent document. Pull orgId in one
    // join so we can authorize against the workspace, not the original
    // creator — any member of the org can revert.
    const versionToRevert = await prisma.documentVersion.findUnique({
      where: { id: versionId },
      include: {
        generatedDoc: {
          select: { id: true, orgId: true, userId: true },
        },
      },
    });

    if (!versionToRevert || !versionToRevert.generatedDoc) {
      return NextResponse.json(
        { error: "Версия не найдена" },
        { status: 404 }
      );
    }

    const docOrgId = versionToRevert.generatedDoc.orgId;
    if (!docOrgId) {
      // Pre-workspace doc that never got back-filled. Fall back to the
      // user's active org and verify they own it.
      const myOrgId =
        session.user.activeOrgId ?? (await ensureActiveOrg(session.user.id));
      if (versionToRevert.generatedDoc.userId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // Re-link the doc to the user's active org so subsequent reads
      // route through the workspace path.
      await prisma.generatedDocument.update({
        where: { id: versionToRevert.generatedDoc.id },
        data: { orgId: myOrgId },
      });
    } else {
      // Workspace-scoped: any MEMBER+ can revert. The strict per-user
      // check we used to ship would prevent a teammate from rolling
      // back a doc the original creator started.
      try {
        await requireMembership(session.user.id, docOrgId, "MEMBER");
      } catch (e) {
        if (e instanceof OrgAccessError) {
          return NextResponse.json(
            { error: e.message },
            { status: e.status }
          );
        }
        throw e;
      }
    }

    const docId = versionToRevert.generatedDoc.id;

    // Atomic: append a new "revert" version + denormalize content +
    // formData onto the parent doc so the regular /generated/[id]
    // page reflects the rollback immediately.
    const newVersion = await prisma.$transaction(async (tx) => {
      const last = await tx.documentVersion.findFirst({
        where: { generatedDocId: docId },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true, content: true },
      });
      const nextVersionNumber = (last?.versionNumber ?? 0) + 1;

      const summary = generateDiffSummary(
        last?.content ?? "",
        versionToRevert.content
      );

      const safeFormData =
        versionToRevert.formData && typeof versionToRevert.formData === "object"
          ? (versionToRevert.formData as Record<string, string>)
          : {};

      const created = await tx.documentVersion.create({
        data: {
          generatedDocId: docId,
          versionNumber: nextVersionNumber,
          title: `Восстановление v${versionToRevert.versionNumber}`,
          content: versionToRevert.content,
          formData: safeFormData,
          changesSummary: `Восстановлена версия ${versionToRevert.versionNumber}. ${summary}`,
          createdBy: session.user.id,
        },
      });

      await tx.generatedDocument.update({
        where: { id: docId },
        data: {
          content: versionToRevert.content,
          formData: safeFormData,
        },
      });

      return created;
    });

    return NextResponse.json({
      version: newVersion,
      documentId: docId,
    });
  } catch (error) {
    console.error("Revert version error:", error);
    return NextResponse.json(
      { error: "Не удалось восстановить версию" },
      { status: 500 }
    );
  }
}
