import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureActiveOrg } from "@/lib/org";
import { reportError } from "@/lib/telemetry";

// GET /api/deals/[id] — full Deal Room state from the sender's
// perspective (clauses, actions, participants).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const orgId = await ensureActiveOrg(session.user.id);
    if (!orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const deal = await prisma.deal.findFirst({
      where: { id, orgId },
      include: {
        participants: true,
        clauses: {
          orderBy: { ord: "asc" },
          include: {
            actions: {
              orderBy: { createdAt: "asc" },
              include: { participant: { select: { id: true, role: true, guestName: true } } },
            },
          },
        },
        document: { select: { fileName: true, rawText: true } },
      },
    });
    if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ deal });
  } catch (error) {
    await reportError(error, { op: "deals.get" });
    return NextResponse.json({ error: "Ошибка загрузки сделки" }, { status: 500 });
  }
}
