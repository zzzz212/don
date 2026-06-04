import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getOrCreateDealSessionId } from "@/lib/deal-session";
import { rateLimit } from "@/lib/rate-limit";
import {
  reconcileClauseStatus,
  latestAcceptedProposalText,
  type ClauseActionInput,
} from "@/lib/deals";
import { reportError } from "@/lib/telemetry";
import { captureEvent } from "@/lib/analytics/server";
import { DEAL_FUNNEL_EVENTS, clauseEventFor } from "@/lib/analytics/deal-funnel";

export const dynamic = "force-dynamic";

const ActionSchema = z.object({
  kind: z.enum(["AGREE", "DISAGREE", "COMMENT", "PROPOSE_EDIT", "ACCEPT_PROPOSAL"]),
  body: z.string().trim().max(2000).optional(),
  proposalId: z.string().trim().max(64).optional(),
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
    if (parsed.data.kind === "ACCEPT_PROPOSAL" && !parsed.data.proposalId) {
      return NextResponse.json({ error: "Не указано принимаемое предложение" }, { status: 400 });
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
        proposalId: parsed.data.proposalId ?? null,
      },
    });

    const allActions = await prisma.clauseAction.findMany({
      where: { clauseId },
      select: { id: true, participantId: true, kind: true, body: true, proposalId: true, createdAt: true },
    });
    const reconciled: ClauseActionInput[] = allActions.map((a) => ({
      id: a.id,
      participantId: a.participantId,
      kind: a.kind as ClauseActionInput["kind"],
      body: a.body,
      proposalId: a.proposalId,
      createdAt: a.createdAt,
    }));
    const newStatus = reconcileClauseStatus(reconciled, sender.id, receiver.id);
    // Snapshot the settled wording so the final document can export the
    // agreed text. Otherwise leave any prior agreedText untouched.
    const settledText =
      newStatus === "RESOLVED" ? (latestAcceptedProposalText(reconciled) ?? undefined) : undefined;
    await prisma.dealClause.update({
      where: { id: clauseId },
      data: { status: newStatus, ...(settledText !== undefined ? { agreedText: settledText } : {}) },
    });

    // Sync deal.status with the current state of all clauses. Same logic
    // as the sender route — promote to AGREED when nothing is open,
    // demote back to ACTIVE if a previously-AGREED clause flips back.
    const stillOpen = await prisma.dealClause.count({
      where: { dealId: clause.dealId, status: { notIn: ["AGREED", "RESOLVED"] } },
    });
    const desiredStatus = stillOpen === 0 ? "AGREED" : "ACTIVE";
    await prisma.deal.updateMany({
      where: { id: clause.dealId, status: { not: desiredStatus } },
      data: { status: desiredStatus },
    });

    // Funnel: per-clause resolution + deal completion, receiver side.
    // distinctId is the opaque session id (PII-free); the workspace group
    // key is the deal's org so receiver-side events roll up to the owner's
    // workspace rather than the anonymous session.
    const clauseEvent = clauseEventFor(newStatus);
    if (clauseEvent) {
      void captureEvent({
        userId: sessionId,
        orgId: clause.deal.orgId,
        event: clauseEvent,
        properties: { role: "RECEIVER" },
      });
    }
    if (desiredStatus === "AGREED") {
      void captureEvent({
        userId: sessionId,
        orgId: clause.deal.orgId,
        event: DEAL_FUNNEL_EVENTS.dealAgreedComplete,
        properties: { role: "RECEIVER" },
      });
    }

    return NextResponse.json({ ok: true, clauseStatus: newStatus });
  } catch (error) {
    await reportError(error, { op: "deals.by_token.clause_action" });
    return NextResponse.json({ error: "Ошибка действия" }, { status: 500 });
  }
}
