import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { reportError } from "@/lib/telemetry";

// GET /api/deadlines — the signed-in user's contract calendar:
//   • deadlines          — saved key dates, soonest first
//   • scannableDocuments — recent contracts not yet scanned for dates
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const me = session.user.id;

    const [deadlines, scannable] = await Promise.all([
      prisma.contractDeadline.findMany({
        where: { userId: me, dismissed: false },
        orderBy: { dueDate: "asc" },
        include: { document: { select: { id: true, fileName: true } } },
      }),
      prisma.document.findMany({
        where: { userId: me, deadlines: { none: {} } },
        orderBy: { createdAt: "desc" },
        take: 15,
        select: { id: true, fileName: true, createdAt: true },
      }),
    ]);

    return NextResponse.json({
      deadlines: deadlines.map((d) => ({
        id: d.id,
        kind: d.kind,
        label: d.label,
        dueDate: d.dueDate.toISOString(),
        documentId: d.documentId,
        documentName: d.document.fileName,
      })),
      scannableDocuments: scannable.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        createdAt: d.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    await reportError(error, { op: "deadlines.list" });
    return NextResponse.json(
      { error: "Не удалось загрузить сроки" },
      { status: 500 }
    );
  }
}
