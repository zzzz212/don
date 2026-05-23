import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureActiveOrg, getMembership } from "@/lib/org";
import { rateLimit } from "@/lib/rate-limit";
import { reconcileClauseStatus } from "@/lib/deals";
import { logAudit } from "@/lib/audit";
import { reportError } from "@/lib/telemetry";

const ActionSchema = z.object({
  kind: z.enum(["AGREE", "DISAGREE", "COMMENT", "PROPOSE_EDIT"]),
  body: z.string().trim().max(2000).optional(),
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

    // If every clause in the deal is AGREED, flip deal.status.
    const stillOpen = await prisma.dealClause.count({
      where: { dealId, status: { not: "AGREED" } },
    });
    if (stillOpen === 0) {
      await prisma.deal.update({ where: { id: dealId }, data: { status: "AGREED" } });
    }

    await logAudit({
      action: "deal.clause_action",
      userId: me,
      orgId,
      payload: { dealId, clauseId, kind: parsed.data.kind, role: "SENDER" },
    });

    return NextResponse.json({ ok: true, clauseStatus: newStatus });
  } catch (error) {
    await reportError(error, { op: "deals.clause_action.sender" });
    return NextResponse.json({ error: "Ошибка действия" }, { status: 500 });
  }
}
