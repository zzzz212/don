import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getOrCreateDealSessionId } from "@/lib/deal-session";
import { rateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

// GET /api/deals/by-token/[token] — opens a Deal Room.
// • Authenticated owner of the deal → sender perspective (their participantId).
// • Anonymous receiver → claims the RECEIVER participant via session cookie;
//   subsequent visits update lastSeenAt.
// • Other anonymous visitors → read-only view (myParticipantId stays null).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const session = await auth();

    // Token-scoped rate limit. Each deal can be polled at most 60×/min;
    // the action endpoint is separately throttled per-session. Without
    // this, a leaked token enables free DB hammering with deep includes.
    const rl = await rateLimit(`deals.by_token.get:${token}`, "deals.action");
    if (!rl.ok) {
      return NextResponse.json({ error: "Слишком много обращений." }, { status: 429 });
    }

    const deal = await prisma.deal.findUnique({
      where: { inviteToken: token },
      include: {
        participants: { include: { user: { select: { name: true } } } },
        clauses: {
          orderBy: { ord: "asc" },
          include: {
            actions: {
              orderBy: { createdAt: "asc" },
              include: {
                participant: {
                  select: {
                    id: true,
                    role: true,
                    guestName: true,
                    user: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
        document: { select: { fileName: true, rawText: true } },
        // Only the owner's display name leaves this endpoint. Email is
        // PII and must not be exposed to anonymous viewers via the
        // public token URL (anyone with the link could read it).
        owner: { select: { name: true } },
      },
    });
    if (!deal) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

    // Authenticated owner of this deal → sender perspective.
    const isOwner = !!session?.user?.id && deal.ownerId === session.user.id;
    const sender = deal.participants.find((p) => p.role === "SENDER");
    let myParticipantId: string | null = null;
    let myRole: "SENDER" | "RECEIVER" | null = null;

    if (isOwner && sender) {
      myParticipantId = sender.id;
      myRole = "SENDER";
      await prisma.dealParticipant.update({
        where: { id: sender.id },
        data: { lastSeenAt: new Date() },
      });
    } else {
      // Anonymous receiver path. The claim is done as an ATOMIC
      // conditional update — `updateMany` with `sessionId: null,
      // userId: null` in the WHERE clause. If `count === 1` we won the
      // race; if `count === 0` another session beat us (or already
      // owned the row) and we fall through to the existing-match check.
      // A pure read-then-write would let two concurrent first-time
      // visitors both claim the receiver slot, silently overwriting
      // each other.
      const { sessionId } = await getOrCreateDealSessionId();
      const receiver = deal.participants.find((p) => p.role === "RECEIVER");
      if (receiver) {
        if (!receiver.sessionId && !receiver.userId) {
          const claim = await prisma.dealParticipant.updateMany({
            where: { id: receiver.id, sessionId: null, userId: null },
            data: { sessionId, lastSeenAt: new Date() },
          });
          if (claim.count === 1) {
            myParticipantId = receiver.id;
            myRole = "RECEIVER";
          }
        } else if (receiver.sessionId === sessionId) {
          await prisma.dealParticipant.update({
            where: { id: receiver.id },
            data: { lastSeenAt: new Date() },
          });
          myParticipantId = receiver.id;
          myRole = "RECEIVER";
        }
      }
      // Sprint 14 invariant: one receiver per deal. Other sessions get
      // read-only view (myParticipantId stays null).
    }

    return NextResponse.json({
      deal: {
        id: deal.id,
        title: deal.title,
        status: deal.status,
        owner: deal.owner,
        document: deal.document,
        participants: deal.participants.map((p) => ({
          id: p.id,
          role: p.role,
          name: p.guestName ?? p.user?.name ?? null,
        })),
        clauses: deal.clauses,
      },
      myParticipantId,
      myRole,
    });
  } catch (error) {
    await reportError(error, { op: "deals.by_token.get" });
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}
