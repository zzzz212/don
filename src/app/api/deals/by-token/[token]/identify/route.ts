import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOrCreateDealSessionId } from "@/lib/deal-session";
import { rateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/telemetry";
import { captureEvent } from "@/lib/analytics/server";
import { DEAL_FUNNEL_EVENTS } from "@/lib/analytics/deal-funnel";

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

    // Rate-limit per session so a hostile caller can't spam this
    // endpoint trying to claim or rename participants.
    const rl = await rateLimit(`deals.identify:${sessionId}`, "deals.action");
    if (!rl.ok) {
      return NextResponse.json({ error: "Слишком много попыток." }, { status: 429 });
    }

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

    // Identify is "set my display name" — it presupposes a successful
    // GET /by-token claim has already bound this session to the
    // receiver row. We do NOT allow identify to also claim the slot
    // (that would let an attacker pre-claim the receiver via a single
    // POST before the real recipient ever opens the link). The claim
    // path lives only in GET /by-token, where it uses an atomic
    // updateMany guarded by sessionId IS NULL.
    if (receiver.sessionId !== sessionId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.dealParticipant.update({
      where: { id: receiver.id },
      data: {
        guestName: parsed.data.name,
        lastSeenAt: new Date(),
      },
    });

    // Funnel: receiver put a name to the slot — the strongest pre-register
    // engagement signal. distinctId is the opaque session id (PII-free);
    // we attribute the cohort to the deal owner's org. We never put the
    // guest name in properties (it is PII).
    void captureEvent({
      userId: sessionId,
      orgId: deal.ownerId,
      event: DEAL_FUNNEL_EVENTS.receiverIdentified,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    await reportError(error, { op: "deals.by_token.identify" });
    return NextResponse.json({ error: "Ошибка" }, { status: 500 });
  }
}
