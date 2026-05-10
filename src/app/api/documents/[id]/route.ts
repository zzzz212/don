import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStorage, isStorageAvailable } from "@/lib/storage";
import { reportError } from "@/lib/telemetry";
import { ensureActiveOrg } from "@/lib/org";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const orgId =
      session.user.activeOrgId ?? (await ensureActiveOrg(session.user.id));
    const { id } = await params;

    // Workspace-scoped lookup. Documents from other workspaces (or no
    // workspace at all) come back as 404 — same shape as a missing id, so
    // the response can't be used to enumerate which doc ids exist elsewhere.
    const document = await prisma.document.findFirst({
      where: { id, orgId },
      include: { analysis: true },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Документ не найден" },
        { status: 404 }
      );
    }

    const metadata = document.analysis?.metadata
      ? JSON.parse(document.analysis.metadata)
      : {};

    return NextResponse.json({
      id: document.id,
      fileName: document.fileName,
      fileSize: document.fileSize,
      mimeType: document.mimeType,
      hasOriginal: !!document.blobKey,
      // Plain-text body of the contract — needed by the report page so
      // the user can apply per-risk fixes (originalText → recommendedText)
      // without round-tripping back to the OCR/extract step. Null for
      // legacy rows that never stored rawText.
      rawText: document.rawText ?? null,
      score: document.analysis?.score ?? 0,
      summary: document.analysis?.summary ?? "",
      risks: document.analysis ? JSON.parse(document.analysis.risks) : [],
      contractType: metadata.contractType,
      parties: metadata.parties,
      verdict: metadata.verdict,
      verdictReason: metadata.verdictReason,
      notarization: metadata.notarization,
      registration: metadata.registration,
      missingClauses: metadata.missingClauses,
      preSigningChecklist: metadata.preSigningChecklist,
      isDemo: metadata.isDemo,
      createdAt: document.createdAt,
    });
  } catch (error) {
    await reportError(error, { op: "documents.get" });
    return NextResponse.json(
      { error: "Ошибка при загрузке документа" },
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
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const orgId =
      session.user.activeOrgId ?? (await ensureActiveOrg(session.user.id));
    const { id } = await params;

    // Org-scoped lookup so any member of the workspace can delete a doc.
    // Foreign-org docs return 404, not 403 — anti-enumeration.
    const document = await prisma.document.findFirst({
      where: { id, orgId },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Документ не найден" },
        { status: 404 }
      );
    }

    // Best-effort blob cleanup — log on failure, don't block deletion.
    if (document.blobKey && isStorageAvailable()) {
      try {
        await getStorage().delete(document.blobKey);
      } catch (e) {
        console.error("[documents/delete] blob cleanup failed:", e);
      }
    }

    await prisma.document.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    await reportError(error, { op: "documents.delete" });
    return NextResponse.json(
      { error: "Ошибка при удалении документа" },
      { status: 500 }
    );
  }
}
