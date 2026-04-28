import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
