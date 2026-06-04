import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureActiveOrg, requireMembership, OrgAccessError } from "@/lib/org";
import { reportError } from "@/lib/telemetry";
import { getEffectiveUserPlan } from "@/lib/plans";
import { checkTrialEligibility } from "@/lib/billing/trial";
import { applyExpiryDowngrade } from "@/lib/billing";

// GET /api/billing/status
//   Returns the user's current plan/trial state plus the workspace's
//   payment history. Plan and trial fields are USER-scoped now (one
//   subscription = PRO across every workspace they own); the payments
//   list and OWNER gate are still per-workspace because each org has
//   its own billing thread for accounting purposes.
//
//   Used by /billing page (OWNER+ only) AND by AccountMenu's plan-chip
//   probe — read access is the same, AccountMenu just ignores `payments`.
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json(
      { error: "Требуется авторизация" },
      { status: 401 }
    );
  }

  try {
    const orgId =
      session.user.activeOrgId ?? (await ensureActiveOrg(userId));
    const membership = await requireMembership(userId, orgId, "OWNER");

    // Lazy expiry downgrade: no renewal cron yet, so a canceled sub whose
    // period has elapsed is reconciled to FREE here, on the OWNER's own
    // billing read, before we resolve the effective plan below.
    await applyExpiryDowngrade(orgId);

    const [user, subscription, payments, trialEligibility] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true, trialEndsAt: true },
      }),
      prisma.subscription.findUnique({ where: { orgId } }),
      prisma.payment.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          plan: true,
          amountKopecks: true,
          currency: true,
          status: true,
          createdAt: true,
          succeededAt: true,
          failureReason: true,
          providerPaymentId: true,
        },
      }),
      checkTrialEligibility(userId, orgId),
    ]);

    const effective = getEffectiveUserPlan({
      plan: user?.plan,
      trialEndsAt: user?.trialEndsAt ?? null,
    });

    return NextResponse.json({
      orgId,
      orgName: membership.organization.name,
      effectivePlan: effective.plan,
      baselinePlan: effective.baselinePlan,
      isTrial: effective.isTrial,
      trialEndsAt: effective.trialEndsAt
        ? effective.trialEndsAt.toISOString()
        : null,
      trialDaysLeft: effective.trialDaysLeft,
      canActivateTrial: trialEligibility.canActivate,
      subscription: subscription
        ? {
            plan: subscription.plan,
            status: subscription.status,
            currentPeriodStart: subscription.currentPeriodStart.toISOString(),
            currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            canceledAt: subscription.canceledAt
              ? subscription.canceledAt.toISOString()
              : null,
            hasSavedPaymentMethod: !!subscription.providerPaymentMethodId,
          }
        : null,
      payments: payments.map((p) => ({
        id: p.id,
        plan: p.plan,
        amountRub: Math.round(p.amountKopecks / 100),
        currency: p.currency,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        succeededAt: p.succeededAt ? p.succeededAt.toISOString() : null,
        failureReason: p.failureReason,
      })),
    });
  } catch (error) {
    if (error instanceof OrgAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    await reportError(error, { op: "billing.status", userId });
    return NextResponse.json(
      { error: "Не удалось загрузить состояние биллинга" },
      { status: 500 }
    );
  }
}
