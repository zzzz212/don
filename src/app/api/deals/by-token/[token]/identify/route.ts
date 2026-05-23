import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOrCreateDealSessionId } from "@/lib/deal-session";
import { reportError } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

const IdentifySchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { sessionId } = await getOrCreateDealSessionId();

    const parsed = IdentifySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Имя обязательно" }, { status: 400 });
    }

    const deal = await prisma.deal.findUnique({
      where: { inviteToken: token },
      include: { participants: { where: { role: "RECEIVER" } } },
    });
    if (!deal) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
    const receiver = deal.participants[0];
    if (!receiver) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

    // Receiver can identify themselves if (a) the session matches OR
    // (b) the receiver row was never claimed.
    const canIdentify =
      receiver.sessionId === sessionId ||
      (!receiver.sessionId && !receiver.userId);
    if (!canIdentify) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.dealParticipant.update({
      where: { id: receiver.id },
      data: {
        sessionId,
        guestName: parsed.data.name,
        lastSeenAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    await reportError(error, { op: "deals.by_token.identify" });
    return NextResponse.json({ error: "Ошибка" }, { status: 500 });
  }
}
