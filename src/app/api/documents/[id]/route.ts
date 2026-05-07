import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStorage, isStorageAvailable } from "@/lib/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id } = await params;

    const document = await prisma.document.findUnique({
      where: { id, userId: session.user.id },
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
      score: document.analysis?.score ?? 0,
      summary: document.analysis?.summary ?? "",
      risks: document.analysis ? JSON.parse(document.analysis.risks) : [],
      contractType: metadata.contractType,
      parties: metadata.parties,
      notarization: metadata.notarization,
      registration: metadata.registration,
      missingClauses: metadata.missingClauses,
      preSigningChecklist: metadata.preSigningChecklist,
      isDemo: metadata.isDemo,
      createdAt: document.createdAt,
    });
  } catch (error) {
    console.error("Document fetch error:", error);
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

    const { id } = await params;

    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Документ не найден" },
        { status: 404 }
      );
    }

    if (document.userId !== session.user.id) {
      return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
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
    console.error("Document deletion error:", error);
    return NextResponse.json(
      { error: "Ошибка при удалении документа" },
      { status: 500 }
    );
  }
}
