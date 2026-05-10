import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureActiveOrg, requireMembership, OrgAccessError } from "@/lib/org";
import { reportError } from "@/lib/telemetry";
import { getEffectivePlan } from "@/lib/plans";

// GET /api/billing/status
//   Returns the workspace's current subscription state and the most
//   recent payments (history). Used by /billing page. OWNER+ only —
//   regular members shouldn't see billing details.
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

    const [subscription, payments] = await Promise.all([
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
    ]);

    const effective = getEffectivePlan({
      plan: membership.organization.plan,
      trialEndsAt: membership.organization.trialEndsAt,
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
