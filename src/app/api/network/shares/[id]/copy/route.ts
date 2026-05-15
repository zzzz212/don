import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureActiveOrg } from "@/lib/org";
import { reportError } from "@/lib/telemetry";

// POST /api/network/shares/[id]/copy — the reviewer saves a copy of the
// shared contract (text + analysis) into their own workspace. The blob
// of the original file is not copied — this is a logical copy of the
// reviewed content, owned by the reviewer.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const me = session.user.id;
    const { id } = await params;

    const share = await prisma.documentShare.findUnique({
      where: { id },
      include: { document: { include: { analysis: true } } },
    });
    if (!share || share.toUserId !== me) {
      return NextResponse.json({ error: "Ревью не найдено" }, { status: 404 });
    }
    if (share.status !== "ACCEPTED" && share.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Сначала примите ревью, затем документ можно скопировать" },
        { status: 409 }
      );
    }
    if (!share.document) {
      return NextResponse.json({ error: "Документ недоступен" }, { status: 404 });
    }

    const orgId = await ensureActiveOrg(me);
    const orig = share.document;

    const copy = await prisma.document.create({
      data: {
        userId: me,
        orgId,
        fileName: orig.fileName,
        fileSize: orig.fileSize,
        rawText: orig.rawText,
        mimeType: orig.mimeType,
        analysis: orig.analysis
          ? {
              create: {
                score: orig.analysis.score,
                summary: orig.analysis.summary,
                risks: orig.analysis.risks,
                metadata: orig.analysis.metadata,
              },
            }
          : undefined,
      },
    });

    return NextResponse.json({ documentId: copy.id });
  } catch (error) {
    await reportError(error, { op: "network.shares.copy" });
    return NextResponse.json(
      { error: "Не удалось скопировать документ" },
      { status: 500 }
    );
  }
}
