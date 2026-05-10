import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureActiveOrg, requireMembership, OrgAccessError } from "@/lib/org";
import { rateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/telemetry";
import {
  createCheckoutSession,
  BillingError,
  isBillingConfigured,
} from "@/lib/billing";
import { isPaidPlan } from "@/lib/legal-info";
import { captureEvent } from "@/lib/analytics/server";
import { logAudit, attribution } from "@/lib/audit";

// POST /api/billing/checkout  { plan: "PRO" | "BUSINESS" }
//   Creates a pending Payment + ЮKassa payment, returns the confirmation
//   URL the browser should redirect to. OWNER-only — billing is a
//   workspace-scope decision, ADMINs/MEMBERs can't trigger charges.
export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  const userEmail = session?.user?.email;

  if (!userId || !userEmail) {
    return NextResponse.json(
      { error: "Требуется авторизация" },
      { status: 401 }
    );
  }

  // IP-scoped rate limit — checkout is a payment-side-effect endpoint, we
  // want abuse-resistance even though OWNER-only.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const rl = await rateLimit(ip, "billing.checkout");
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком много попыток. Попробуйте через минуту." },
      { status: 429 }
    );
  }

  try {
    if (!isBillingConfigured()) {
      return NextResponse.json(
        {
          error:
            "Платежи временно недоступны. Свяжитесь с поддержкой для оплаты.",
        },
        { status: 503 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      plan?: unknown;
    };
    const plan = typeof body.plan === "string" ? body.plan : "";
    if (!isPaidPlan(plan)) {
      return NextResponse.json(
        { error: "Укажите тариф PRO или BUSINESS" },
        { status: 400 }
      );
    }

    const orgId = session.user.activeOrgId ?? (await ensureActiveOrg(userId));
    await requireMembership(userId, orgId, "OWNER");

    // Already on this plan with active subscription? Block double-charge.
    const existing = await prisma.subscription.findUnique({
      where: { orgId },
      select: { plan: true, status: true, currentPeriodEnd: true },
    });
    if (
      existing &&
      existing.plan === plan &&
      existing.status === "ACTIVE" &&
      existing.currentPeriodEnd.getTime() > Date.now()
    ) {
      return NextResponse.json(
        {
          error: `Тариф «${plan === "PRO" ? "Про" : "Бизнес"}» уже активен. Продление откроется ближе к окончанию периода.`,
        },
        { status: 409 }
      );
    }

    const origin =
      request.headers.get("origin") ??
      `https://${request.headers.get("host") ?? "localhost"}`;
    const returnUrl = `${origin}/billing/return`;

    const sessionResult = await createCheckoutSession({
      orgId,
      userId,
      userEmail,
      plan,
      returnUrl,
    });

    void captureEvent({
      userId,
      orgId,
      event: "checkout_started",
      properties: { plan, paymentId: sessionResult.paymentId },
    });
    void logAudit({
      orgId,
      userId,
      action: "billing.checkout_started",
      target: sessionResult.paymentId,
      targetType: "payment",
      payload: { plan },
      ...attribution(request),
    });

    return NextResponse.json({
      paymentId: sessionResult.paymentId,
      confirmationUrl: sessionResult.confirmationUrl,
    });
  } catch (error) {
    if (error instanceof OrgAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof BillingError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    await reportError(error, { op: "billing.checkout", userId });
    return NextResponse.json(
      { error: "Не удалось начать оплату. Попробуйте позже." },
      { status: 500 }
    );
  }
}
