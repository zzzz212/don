import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureActiveOrg } from "@/lib/org";
import { rateLimit } from "@/lib/rate-limit";
import { createDealFromDocument } from "@/lib/deals";
import { sendEmail } from "@/lib/email";
import { buildDealInviteEmail } from "@/lib/email/templates/deal-invite";
import { BRAND } from "@/lib/legal-info";
import { logAudit } from "@/lib/audit";
import { reportError } from "@/lib/telemetry";

const CreateSchema = z.object({
  documentId: z.string().min(1),
  counterpartyEmail: z.string().email(),
  counterpartyName: z.string().trim().max(120).optional(),
  message: z.string().trim().max(500).optional(),
});

// POST /api/deals — create a Deal Room from an analysed document and
// send the invite email.
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const me = session.user.id;

    const orgId = await ensureActiveOrg(me);
    if (!orgId) {
      return NextResponse.json({ error: "Нет активной организации" }, { status: 400 });
    }

    const rl = await rateLimit(`deals.create:${me}`, "deals.create");
    if (!rl.ok) {
      return NextResponse.json({ error: "Слишком много deals подряд. Подождите минуту." }, { status: 429 });
    }

    const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }
    const { documentId, counterpartyEmail, counterpartyName, message } = parsed.data;

    const { deal, clauseCount } = await createDealFromDocument({
      ownerId: me,
      orgId,
      documentId,
      counterpartyEmail,
      counterpartyName,
    });

    // Fetch the title for the email — createDealFromDocument doesn't return it.
    const fullDeal = await prisma.deal.findUnique({
      where: { id: deal.id },
      select: { title: true },
    });

    // Fire-and-forget invite email — failures land in Sentry via
    // sendEmail's internal handler.
    void sendEmail(
      buildDealInviteEmail({
        to: counterpartyEmail,
        fromName: session.user.name ?? session.user.email ?? "Пользователь",
        documentName: fullDeal?.title ?? "Договор",
        dealUrl: `${BRAND.publicUrl}/deal/${deal.inviteToken}`,
        message,
      })
    );

    await logAudit({
      action: "deal.created",
      userId: me,
      orgId,
      payload: { dealId: deal.id, counterpartyEmail, clauseCount },
    });

    return NextResponse.json({
      dealId: deal.id,
      inviteToken: deal.inviteToken,
      url: `${BRAND.publicUrl}/deal/${deal.inviteToken}`,
    });
  } catch (error) {
    await reportError(error, { op: "deals.create" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось создать сделку" },
      { status: 500 }
    );
  }
}

// GET /api/deals — list deals owned by the viewer's active org.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const orgId = await ensureActiveOrg(session.user.id);
    if (!orgId) return NextResponse.json({ deals: [] });

    const deals = await prisma.deal.findMany({
      where: { orgId },
      orderBy: { updatedAt: "desc" },
      include: {
        participants: {
          where: { role: "RECEIVER" },
          select: { guestName: true, guestEmail: true, lastSeenAt: true },
        },
        _count: { select: { clauses: true } },
      },
    });

    return NextResponse.json({
      deals: deals.map((d) => ({
        id: d.id,
        title: d.title,
        status: d.status,
        clauseCount: d._count.clauses,
        receiver: d.participants[0] ?? null,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
    });
  } catch (error) {
    await reportError(error, { op: "deals.list" });
    return NextResponse.json({ error: "Не удалось загрузить сделки" }, { status: 500 });
  }
}
