import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireAdmin, AdminAccessError } from "@/lib/admin";
import { reportError } from "@/lib/telemetry";
import { PRICING_KOPECKS } from "@/lib/legal-info";

// GET /api/admin/stats
//   Aggregate metrics for the /admin overview page. All counts and sums
//   happen DB-side so we don't hydrate millions of rows. Numbers are
//   real-time — no caching layer yet (cheap on Postgres at our current
//   row counts; can add 5-min memory cache when we hit ~100k users).

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function GET() {
  try {
    const session = await auth();
    requireAdmin(session?.user?.id);

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * MS_PER_DAY);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * MS_PER_DAY);
    const startOfMonthUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    );

    // Run all aggregations in parallel — they're independent COUNT/SUM
    // queries against well-indexed columns.
    const [
      totalUsers,
      newUsers7d,
      newUsers30d,
      totalOrgs,
      orgsByPlan,
      activeTrials,
      activeSubscriptions,
      totalPaymentsAgg,
      paymentsThisMonth,
      analysesThisMonth,
      generatesThisMonth,
      chatsThisMonth,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.organization.count(),
      prisma.organization.groupBy({
        by: ["plan"],
        _count: true,
      }),
      prisma.organization.count({
        where: { trialEndsAt: { gt: now } },
      }),
      prisma.subscription.findMany({
        where: {
          status: "ACTIVE",
          currentPeriodEnd: { gt: now },
        },
        select: { plan: true },
      }),
      prisma.payment.aggregate({
        where: { status: "SUCCEEDED" },
        _sum: { amountKopecks: true },
        _count: true,
      }),
      prisma.payment.count({
        where: {
          status: "SUCCEEDED",
          succeededAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.aiUsage.count({
        where: {
          feature: "analyze",
          createdAt: { gte: startOfMonthUtc },
        },
      }),
      prisma.aiUsage.count({
        where: {
          feature: "generate",
          createdAt: { gte: startOfMonthUtc },
        },
      }),
      prisma.aiUsage.count({
        where: {
          feature: "chat",
          createdAt: { gte: startOfMonthUtc },
        },
      }),
    ]);

    // MRR: sum of monthly subscription prices for active subs. We don't
    // bill annually yet, so every active sub contributes its plan's
    // monthly price. If we add annual plans, divide by 12 here. Plans
    // unknown to PRICING_KOPECKS (e.g. a future tier or a typo'd row)
    // are skipped — better to under-report MRR than to crash the
    // admin dashboard on a stale string.
    const mrrKopecks = activeSubscriptions.reduce((sum, s) => {
      const price =
        PRICING_KOPECKS[s.plan as keyof typeof PRICING_KOPECKS];
      return typeof price === "number" ? sum + price : sum;
    }, 0);

    // planCounts is keyed by raw DB string — legacy "PRO" rows show up
    // alongside new "PRO_SOLO" / "PRO_TEAM" so we can see the migration
    // tail at a glance. Initialise every known key to 0 so the response
    // shape is stable for the UI.
    const planCounts: Record<string, number> = {
      FREE: 0,
      PRO_SOLO: 0,
      PRO_TEAM: 0,
      BUSINESS: 0,
      PRO: 0,
    };
    for (const row of orgsByPlan) {
      planCounts[row.plan] = (planCounts[row.plan] ?? 0) + row._count;
    }

    return NextResponse.json({
      generatedAt: now.toISOString(),
      users: {
        total: totalUsers,
        newLast7d: newUsers7d,
        newLast30d: newUsers30d,
      },
      organizations: {
        total: totalOrgs,
        byPlan: planCounts,
        activeTrials,
      },
      revenue: {
        mrrRub: Math.round(mrrKopecks / 100),
        totalRub: Math.round(
          (totalPaymentsAgg._sum.amountKopecks ?? 0) / 100
        ),
        totalPaymentsCount: totalPaymentsAgg._count,
        paymentsLast30d: paymentsThisMonth,
        activeSubscriptions: activeSubscriptions.length,
      },
      usageThisMonth: {
        analyses: analysesThisMonth,
        generates: generatesThisMonth,
        chats: chatsThisMonth,
      },
    });
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    await reportError(error, { op: "admin.stats" });
    return NextResponse.json(
      { error: "Не удалось загрузить статистику" },
      { status: 500 }
    );
  }
}
