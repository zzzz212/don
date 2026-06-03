import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureActiveOrg, getMembership } from "@/lib/org";
import { rateLimit } from "@/lib/rate-limit";
import { createDealFromDocument } from "@/lib/deals";
import { sendEmail } from "@/lib/email";
import { buildDealInviteEmail } from "@/lib/email/templates/deal-invite";
import { BRAND } from "@/lib/legal-info";
import { logAudit } from "@/lib/audit";
import { reportError } from "@/lib/telemetry";

const CreateSchema = z.object({
  documentId: z.string().min(1),
  // Optional: a sender who shares the link via Telegram/WhatsApp instead
  // of email never supplies an address. `.email()` still validates the
  // format when one IS provided. Empty string is normalised to undefined
  // so the client can send "" without tripping the email-format check.
  counterpartyEmail: z
    .string()
    .email()
    .optional()
    .or(z.literal("").transform(() => undefined)),
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

    // VIEWER role is read-only across the platform (foot-gun #37). Creating
    // a Deal mints rows and fires an email — not allowed.
    const membership = await getMembership(me, orgId);
    if (membership?.role === "VIEWER") {
      return NextResponse.json(
        { error: "Роль «Наблюдатель» не позволяет создавать сделки." },
        { status: 403 }
      );
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

    let createResult: Awaited<ReturnType<typeof createDealFromDocument>>;
    try {
      createResult = await createDealFromDocument({
        ownerId: me,
        orgId,
        documentId,
        counterpartyEmail,
        counterpartyName,
      });
    } catch (err) {
      // Map known application errors to client-facing status codes. We
      // intentionally collapse "not found" and "not owned" into one
      // generic 404 so callers can't probe document IDs across orgs.
      const message = err instanceof Error ? err.message : "";
      if (message.includes("Document not found")) {
        return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
      }
      if (message.includes("not been analysed")) {
        return NextResponse.json(
          { error: "Документ ещё не проанализирован — дождитесь окончания анализа." },
          { status: 422 }
        );
      }
      if (message.includes("Analysis.risks")) {
        return NextResponse.json(
          { error: "Анализ договора повреждён. Запустите анализ заново." },
          { status: 422 }
        );
      }
      throw err; // unknown error → outer catch → 500
    }
    const { deal, clauseCount } = createResult;

    // Fetch the title for the email — createDealFromDocument doesn't return it.
    const fullDeal = await prisma.deal.findUnique({
      where: { id: deal.id },
      select: { title: true },
    });

    // Fire-and-forget invite email — only when an address was supplied.
    // Without one, the sender shares the link manually (Telegram/WhatsApp)
    // from the success share-sheet. Failures land in Sentry via
    // sendEmail's internal handler.
    if (counterpartyEmail) {
      void sendEmail(
        buildDealInviteEmail({
          to: counterpartyEmail,
          fromName: session.user.name ?? session.user.email ?? "Пользователь",
          documentName: fullDeal?.title ?? "Договор",
          dealUrl: `${BRAND.publicUrl}/deal/${deal.inviteToken}`,
          message,
        })
      );
    }

    // Key name `email` (not `counterpartyEmail`) so `redact()` masks it
    // in the audit log per foot-gun #26 — SENSITIVE_KEYS matches exact
    // key names, not substrings. Spread it in only when present so the
    // log doesn't carry an `email: undefined` for link-shared deals.
    await logAudit({
      action: "deal.created",
      userId: me,
      orgId,
      payload: {
        dealId: deal.id,
        clauseCount,
        ...(counterpartyEmail ? { email: counterpartyEmail } : {}),
      },
    });

    return NextResponse.json({
      dealId: deal.id,
      inviteToken: deal.inviteToken,
      url: `${BRAND.publicUrl}/deal/${deal.inviteToken}`,
      emailSent: Boolean(counterpartyEmail),
    });
  } catch (error) {
    await reportError(error, { op: "deals.create" });
    return NextResponse.json(
      { error: "Не удалось создать сделку" },
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
        inviteToken: d.inviteToken,
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
