import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireAdmin, AdminAccessError } from "@/lib/admin";
import { reportError } from "@/lib/telemetry";
import { isPaidPlan, type PaidPlan } from "@/lib/legal-info";
import { logAudit, attribution } from "@/lib/audit";

// POST /api/admin/users/[id]/change-plan  { orgId, plan, periodMonths?: number }
//
// Manually flip a workspace to a paid plan WITHOUT a real payment —
// for comp accounts, beta testers, support resolution. The action is
// audited to the admin user via Sentry breadcrumb (and once we ship
// the AuditEvent table in a future sprint, will be persisted there).
//
// We do not create a Payment row for this — those represent real money
// movements. Instead we upsert a Subscription with a 30-day period
// (configurable via periodMonths, capped at 12) and set the org's plan
// directly. The org also has trialEndsAt cleared since they're paid now.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    requireAdmin(session?.user?.id);

    const { id: userId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      orgId?: unknown;
      plan?: unknown;
      periodMonths?: unknown;
    };
    const orgId = typeof body.orgId === "string" ? body.orgId : "";
    const planRaw = typeof body.plan === "string" ? body.plan : "";
    const periodMonths =
      typeof body.periodMonths === "number" &&
      body.periodMonths >= 1 &&
      body.periodMonths <= 12
        ? Math.floor(body.periodMonths)
        : 1;

    if (!orgId) {
      return NextResponse.json({ error: "orgId обязателен" }, { status: 400 });
    }
    if (planRaw !== "FREE" && !isPaidPlan(planRaw)) {
      return NextResponse.json(
        {
          error:
            "plan должен быть FREE / PRO_SOLO / PRO_TEAM / BUSINESS (или legacy PRO)",
        },
        { status: 400 }
      );
    }

    const ownership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId } },
      select: { role: true },
    });
    if (!ownership || ownership.role !== "OWNER") {
      return NextResponse.json(
        { error: "Пользователь не является владельцем этого workspace" },
        { status: 400 }
      );
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true },
    });
    if (!org) {
      return NextResponse.json(
        { error: "Workspace не найден" },
        { status: 404 }
      );
    }

    const now = new Date();

    if (planRaw === "FREE") {
      // Downgrade: write through to BOTH User.plan (authoritative for
      // quota) and Organization.plan (legacy mirror) so the change is
      // visible to checkQuotaSafe on the next request. Previously this
      // route only touched Org.plan — quota then ignored it and kept
      // serving the old tier's limits.
      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { plan: "FREE", trialEndsAt: null },
        }),
        prisma.organization.update({
          where: { id: orgId },
          data: { plan: "FREE", trialEndsAt: null },
        }),
        prisma.subscription.updateMany({
          where: { orgId },
          data: {
            status: "CANCELED",
            canceledAt: now,
            cancelAtPeriodEnd: false,
          },
        }),
      ]);
      void logAudit({
        orgId,
        userId: session!.user!.id,
        action: "billing.plan_changed_manually",
        target: orgId,
        targetType: "subscription",
        payload: { previousPlan: org.plan, newPlan: "FREE", targetUserId: userId },
        ...attribution(request),
      });
      return NextResponse.json({
        ok: true,
        plan: "FREE" as const,
      });
    }

    // Upgrade to a paid plan.
    const paidPlan: PaidPlan = planRaw;
    const periodEnd = new Date(now.getTime() + periodMonths * 30 * MS_PER_DAY);

    // Upgrade: same dual-write reasoning as the FREE branch — User.plan
    // is what quota actually reads; without it the admin "change plan"
    // is a no-op for limit purposes.
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { plan: paidPlan, trialEndsAt: null },
      }),
      prisma.organization.update({
        where: { id: orgId },
        data: { plan: paidPlan, trialEndsAt: null },
      }),
      prisma.subscription.upsert({
        where: { orgId },
        create: {
          orgId,
          userId,
          plan: paidPlan,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          provider: "manual",
        },
        update: {
          userId,
          plan: paidPlan,
          status: "ACTIVE",
          cancelAtPeriodEnd: false,
          canceledAt: null,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          provider: "manual",
        },
      }),
    ]);

    void logAudit({
      orgId,
      userId: session!.user!.id,
      action: "billing.plan_changed_manually",
      target: orgId,
      targetType: "subscription",
      payload: {
        previousPlan: org.plan,
        newPlan: paidPlan,
        periodMonths,
        targetUserId: userId,
      },
      ...attribution(request),
    });

    return NextResponse.json({
      ok: true,
      plan: paidPlan,
      currentPeriodEnd: periodEnd.toISOString(),
    });
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    await reportError(error, { op: "admin.users.change-plan" });
    return NextResponse.json(
      { error: "Не удалось изменить тариф" },
      { status: 500 }
    );
  }
}
