import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOrCreateDealSessionId } from "@/lib/deal-session";
import { rateLimit } from "@/lib/rate-limit";
import { reconcileClauseStatus } from "@/lib/deals";
import { reportError } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

const ActionSchema = z.object({
  kind: z.enum(["AGREE", "DISAGREE", "COMMENT", "PROPOSE_EDIT"]),
  body: z.string().trim().max(2000).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; clauseId: string }> }
) {
  try {
    const { token, clauseId } = await params;
    const { sessionId } = await getOrCreateDealSessionId();

    const rl = await rateLimit(`deals.action:${sessionId}`, "deals.action");
    if (!rl.ok) {
      return NextResponse.json({ error: "Слишком много действий подряд." }, { status: 429 });
    }

    const parsed = ActionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }
    if ((parsed.data.kind === "COMMENT" || parsed.data.kind === "PROPOSE_EDIT") && !parsed.data.body) {
      return NextResponse.json({ error: "Комментарий не может быть пустым" }, { status: 400 });
    }

    const clause = await prisma.dealClause.findFirst({
      where: { id: clauseId, deal: { inviteToken: token } },
      include: {
        deal: {
          include: {
            participants: { select: { id: true, role: true, sessionId: true, userId: true } },
          },
        },
      },
    });
    if (!clause) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

    const receiver = clause.deal.participants.find(
      (p) => p.role === "RECEIVER" && p.sessionId === sessionId
    );
    const sender = clause.deal.participants.find((p) => p.role === "SENDER");
    if (!receiver || !sender) {
      return NextResponse.json(
        { error: "Сессия не привязана к сделке. Откройте ссылку заново." },
        { status: 403 }
      );
    }

    await prisma.clauseAction.create({
      data: {
        clauseId,
        participantId: receiver.id,
        kind: parsed.data.kind,
        body: parsed.data.body ?? null,
      },
    });

    const allActions = await prisma.clauseAction.findMany({
      where: { clauseId },
      select: { participantId: true, kind: true, createdAt: true },
    });
    const newStatus = reconcileClauseStatus(
      allActions.map((a) => ({
        participantId: a.participantId,
        kind: a.kind as "AGREE" | "DISAGREE" | "COMMENT" | "PROPOSE_EDIT",
        createdAt: a.createdAt,
      })),
      sender.id,
      receiver.id
    );
    await prisma.dealClause.update({
      where: { id: clauseId },
      data: { status: newStatus },
    });

    // Sync deal.status with the current state of all clauses. Same logic
    // as the sender route — promote to AGREED when nothing is open,
    // demote back to ACTIVE if a previously-AGREED clause flips back.
    const stillOpen = await prisma.dealClause.count({
      where: { dealId: clause.dealId, status: { not: "AGREED" } },
    });
    const desiredStatus = stillOpen === 0 ? "AGREED" : "ACTIVE";
    await prisma.deal.updateMany({
      where: { id: clause.dealId, status: { not: desiredStatus } },
      data: { status: desiredStatus },
    });

    return NextResponse.json({ ok: true, clauseStatus: newStatus });
  } catch (error) {
    await reportError(error, { op: "deals.by_token.clause_action" });
    return NextResponse.json({ error: "Ошибка действия" }, { status: 500 });
  }
}
