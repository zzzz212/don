import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getMembership } from "@/lib/org";
import { extractDeadlines } from "@/lib/ai/deadlines";
import { reportError } from "@/lib/telemetry";

// The AI extraction is a single fast-tier call, but a long contract can
// still take a while — give it headroom over the Hobby 60s default.
export const maxDuration = 60;

// POST /api/documents/[id]/deadlines — scan an analysed contract for key
// dates and (re)build its ContractDeadline rows. Idempotent: re-running
// replaces the previous set for this document.
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

    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, userId: true, orgId: true, rawText: true },
    });
    if (!document) {
      return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
    }
    // Owner, or a member of the workspace the document belongs to.
    const member = document.orgId
      ? await getMembership(me, document.orgId)
      : null;
    if (document.userId !== me && !member) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }
    // Extraction is an AI call — read-only VIEWERs don't spend AI quota,
    // same gate as analyze / generate.
    if (member?.role === "VIEWER") {
      return NextResponse.json(
        { error: "Роль «Наблюдатель» не позволяет запускать анализ дат." },
        { status: 403 }
      );
    }
    if (!document.rawText || document.rawText.trim().length < 100) {
      return NextResponse.json(
        { error: "Текст договора недоступен для анализа дат" },
        { status: 400 }
      );
    }

    const extracted = await extractDeadlines(document.rawText);

    await prisma.$transaction([
      prisma.contractDeadline.deleteMany({ where: { documentId: id } }),
      prisma.contractDeadline.createMany({
        data: extracted.map((d) => ({
          documentId: id,
          userId: document.userId,
          orgId: document.orgId,
          kind: d.kind,
          label: d.label,
          dueDate: d.dueDate,
        })),
      }),
    ]);

    const saved = await prisma.contractDeadline.findMany({
      where: { documentId: id },
      orderBy: { dueDate: "asc" },
    });

    return NextResponse.json({
      count: saved.length,
      deadlines: saved.map((d) => ({
        id: d.id,
        kind: d.kind,
        label: d.label,
        dueDate: d.dueDate.toISOString(),
      })),
    });
  } catch (error) {
    await reportError(error, { op: "documents.deadlines.extract" });
    return NextResponse.json(
      { error: "Не удалось распознать сроки договора" },
      { status: 500 }
    );
  }
}
