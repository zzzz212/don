import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { OrgAccessError, requireMembership } from "@/lib/org";
import { reportError } from "@/lib/telemetry";
import { getEffectivePlan, getPlanLimits, isUnlimited } from "@/lib/plans";

// GET /api/organizations/[id]/usage
//
// Per-workspace usage breakdown for the OWNER's settings page. Shows
// who in the team did how many analyses / generations / chats /
// OCR-uses this month, plus current quota state.
//
// ADMIN+ only — usage data is sensitive (reveals team productivity
// patterns, who's idle, etc.). Members don't see other members' counts.

const FEATURES = ["analyze", "generate", "chat", "ocr"] as const;

function startOfMonthUtc(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}
function startOfNextMonthUtc(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id: orgId } = await params;
    await requireMembership(session.user.id, orgId, "ADMIN");

    const periodStart = startOfMonthUtc();
    const periodEnd = startOfNextMonthUtc();

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true, trialEndsAt: true },
    });
    if (!org) {
      return NextResponse.json(
        { error: "Workspace не найден" },
        { status: 404 }
      );
    }

    const effective = getEffectivePlan({
      plan: org.plan,
      trialEndsAt: org.trialEndsAt,
    });
    const limits = getPlanLimits(effective.plan);

    // Two parallel aggregations:
    //   1. by-user × feature this month  (for the per-member table)
    //   2. by-feature  this month        (for the totals row)
    const [byUserFeature, byFeature, members] = await Promise.all([
      prisma.aiUsage.groupBy({
        by: ["userId", "feature"],
        where: {
          orgId,
          createdAt: { gte: periodStart, lt: periodEnd },
        },
        _count: true,
      }),
      prisma.aiUsage.groupBy({
        by: ["feature"],
        where: {
          orgId,
          createdAt: { gte: periodStart, lt: periodEnd },
        },
        _count: true,
      }),
      prisma.membership.findMany({
        where: { orgId },
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      }),
    ]);

    // Reshape grouped rows into a {[userId]: {[feature]: count}} map
    // for fast UI rendering. Don't ship the raw rows — the client
    // would have to re-pivot them.
    const usageByUser: Record<
      string,
      Record<string, number>
    > = {};
    for (const row of byUserFeature) {
      if (!usageByUser[row.userId]) usageByUser[row.userId] = {};
      usageByUser[row.userId][row.feature] = row._count;
    }

    const totals: Record<string, number> = {
      analyze: 0,
      generate: 0,
      chat: 0,
      ocr: 0,
    };
    for (const row of byFeature) {
      totals[row.feature] = row._count;
    }

    // Each member row pre-bakes their plan-quota status so the client
    // doesn't have to recompute. zero-usage members still appear in
    // the table (you want to see who isn't using the product).
    const memberRows = members.map((m) => {
      const u = usageByUser[m.userId] ?? {};
      return {
        userId: m.userId,
        email: m.user.email,
        name: m.user.name,
        role: m.role,
        usage: {
          analyze: u.analyze ?? 0,
          generate: u.generate ?? 0,
          chat: u.chat ?? 0,
          ocr: u.ocr ?? 0,
        },
        total:
          (u.analyze ?? 0) +
          (u.generate ?? 0) +
          (u.chat ?? 0) +
          (u.ocr ?? 0),
      };
    });
    // Sort by total desc — top contributors first.
    memberRows.sort((a, b) => b.total - a.total);

    return NextResponse.json({
      orgId,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      plan: {
        effective: effective.plan,
        baseline: effective.baselinePlan,
        isTrial: effective.isTrial,
        trialDaysLeft: effective.trialDaysLeft,
      },
      quotas: FEATURES.map((f) => {
        const limit = limits[f];
        const used = totals[f];
        return {
          feature: f,
          used,
          limit: isUnlimited(limit) ? null : limit,
          unlimited: isUnlimited(limit),
          remaining: isUnlimited(limit)
            ? null
            : Math.max(0, limit - used),
        };
      }),
      totals,
      members: memberRows,
    });
  } catch (error) {
    if (error instanceof OrgAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    await reportError(error, { op: "organizations.usage" });
    return NextResponse.json(
      { error: "Не удалось загрузить статистику использования" },
      { status: 500 }
    );
  }
}
