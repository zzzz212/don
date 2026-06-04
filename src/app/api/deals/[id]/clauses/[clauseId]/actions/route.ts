import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureActiveOrg, getMembership } from "@/lib/org";
import { rateLimit } from "@/lib/rate-limit";
import {
  reconcileClauseStatus,
  latestAcceptedProposalText,
  type ClauseActionInput,
} from "@/lib/deals";
import { logAudit } from "@/lib/audit";
import { reportError } from "@/lib/telemetry";
import { captureEvent } from "@/lib/analytics/server";
import { DEAL_FUNNEL_EVENTS, clauseEventFor } from "@/lib/analytics/deal-funnel";

const ActionSchema = z.object({
  kind: z.enum(["AGREE", "DISAGREE", "COMMENT", "PROPOSE_EDIT", "ACCEPT_PROPOSAL"]),
  body: z.string().trim().max(2000).optional(),
  proposalId: z.string().trim().max(64).optional(),
});

// POST /api/deals/[id]/clauses/[clauseId]/actions — sender posts an
// action (agree / disagree / comment / propose edit) on a clause.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; clauseId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const me = session.user.id;
    const orgId = await ensureActiveOrg(me);

    // VIEWER role is read-only across the platform (foot-gun #37).
    const membership = await getMembership(me, orgId);
    if (membership?.role === "VIEWER") {
      return NextResponse.json(
        { error: "Роль «Наблюдатель» не позволяет действовать в сделке." },
        { status: 403 }
      );
    }

    const { id: dealId, clauseId } = await params;

    const rl = await rateLimit(`deals.action:${me}`, "deals.action");
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

    // Verify the clause belongs to a deal owned by sender's org, and
    // locate the SENDER participant in one query.
    const clause = await prisma.dealClause.findFirst({
      where: { id: clauseId, dealId, deal: { orgId } },
      include: {
        deal: {
          include: {
            participants: { select: { id: true, role: true, userId: true } },
          },
        },
      },
    });
    if (!clause) return NextResponse.json({ error: "Clause not found" }, { status: 404 });

    const sender = clause.deal.participants.find(
      (p) => p.role === "SENDER" && p.userId === me
    );
    const receiver = clause.deal.participants.find((p) => p.role === "RECEIVER");
    if (!sender || !receiver) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Insert action, then recompute clause.status from full action history.
    await prisma.clauseAction.create({
      data: {
        clauseId,
        participantId: sender.id,
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
    // When the clause settles on a counter-proposal, snapshot its text so
    // the final document can export the agreed wording. Otherwise leave
    // any prior agreedText untouched.
    const settledText =
      newStatus === "RESOLVED" ? (latestAcceptedProposalText(reconciled) ?? undefined) : undefined;
    await prisma.dealClause.update({
      where: { id: clauseId },
      data: { status: newStatus, ...(settledText !== undefined ? { agreedText: settledText } : {}) },
    });

    // Sync deal.status with the current state of all clauses. Promote to
    // AGREED when no clause is still open; demote back to ACTIVE if a
    // previously-AGREED deal has any clause flip back to DISPUTED/PENDING
    // (a DISAGREE arrived after both parties had AGREEd).
    const stillOpen = await prisma.dealClause.count({
      where: { dealId, status: { notIn: ["AGREED", "RESOLVED"] } },
    });
    const desiredStatus = stillOpen === 0 ? "AGREED" : "ACTIVE";
    await prisma.deal.updateMany({
      where: { id: dealId, status: { not: desiredStatus } },
      data: { status: desiredStatus },
    });

    await logAudit({
      action: "deal.clause_action",
      userId: me,
      orgId,
      payload: { dealId, clauseId, kind: parsed.data.kind, role: "SENDER" },
    });

    // Funnel: per-clause resolution (AGREED/DISPUTED only) + deal-level
    // completion. distinctId is the sender's user cuid (PII-free).
    const clauseEvent = clauseEventFor(newStatus);
    if (clauseEvent) {
      void captureEvent({
        userId: me,
        orgId,
        event: clauseEvent,
        properties: { role: "SENDER" },
      });
    }
    if (desiredStatus === "AGREED") {
      void captureEvent({
        userId: me,
        orgId,
        event: DEAL_FUNNEL_EVENTS.dealAgreedComplete,
        properties: { role: "SENDER" },
      });
    }

    return NextResponse.json({ ok: true, clauseStatus: newStatus });
  } catch (error) {
    await reportError(error, { op: "deals.clause_action.sender" });
    return NextResponse.json({ error: "Ошибка действия" }, { status: 500 });
  }
}
