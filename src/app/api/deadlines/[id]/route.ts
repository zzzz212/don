import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { reportError } from "@/lib/telemetry";

// PATCH /api/deadlines/[id]  { action: "dismiss" }
//   Drop a deadline off the dashboard. The row is kept (dismissed flag)
//   so re-scanning the document doesn't resurrect it as new.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const me = session.user.id;
    const { id } = await params;

    const deadline = await prisma.contractDeadline.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!deadline || deadline.userId !== me) {
      return NextResponse.json({ error: "Срок не найден" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      action?: unknown;
    };
    if (body.action !== "dismiss") {
      return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }

    await prisma.contractDeadline.update({
      where: { id },
      data: { dismissed: true },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await reportError(error, { op: "deadlines.dismiss" });
    return NextResponse.json(
      { error: "Не удалось обновить срок" },
      { status: 500 }
    );
  }
}
