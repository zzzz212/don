import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { reportError } from "@/lib/telemetry";

// POST /api/admin/backfill-user-plan
//   One-shot migration: copy plan + trial state from Organization
//   columns onto the new User columns. After the user-level-plan
//   rollout shipped, existing users still had User.plan = "FREE" /
//   User.trialEndsAt = null because the schema columns were brand-new.
//   This pass walks every user, finds the best plan among the
//   workspaces they OWN, and writes it back.
//
//   Also backfills Subscription.userId by looking up the OWNER of each
//   subscription's orgId.
//
//   Idempotent: re-running picks the max plan again and writes the
//   same values. Safe to call from a cron / GitHub Action / curl.
//
//   Auth: x-admin-key header must match ADMIN_SEED_KEY (default
//   "dev-seed-key" for local). Same gate the other admin routes use.

const PLAN_RANK: Record<string, number> = {
  FREE: 0,
  PRO: 1,
  BUSINESS: 2,
};
const RANK_PLAN: Record<number, string> = {
  0: "FREE",
  1: "PRO",
  2: "BUSINESS",
};

function expectedAdminKey(): string {
  return process.env.ADMIN_SEED_KEY ?? "dev-seed-key";
}

export async function POST(request: Request) {
  const headerKey = request.headers.get("x-admin-key");
  if (headerKey !== expectedAdminKey()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // --- Pass 1: User.plan / User.trialEndsAt from owned orgs --------

    const users = await prisma.user.findMany({
      select: {
        id: true,
        plan: true,
        trialEndsAt: true,
        memberships: {
          where: { role: "OWNER" },
          select: {
            organization: {
              select: { plan: true, trialEndsAt: true },
            },
          },
        },
      },
    });

    let userPlanUpdates = 0;
    let userTrialUpdates = 0;

    for (const u of users) {
      const owned = u.memberships
        .map((m) => m.organization)
        .filter(Boolean);
      if (owned.length === 0) continue;

      // Best plan across owned workspaces.
      const bestRank = owned
        .map((o) => PLAN_RANK[o.plan] ?? 0)
        .reduce((a, b) => Math.max(a, b), 0);
      const bestPlan = RANK_PLAN[bestRank] ?? "FREE";

      // Latest trial end across owned workspaces (may be null).
      const trialEnds = owned
        .map((o) => o.trialEndsAt?.getTime())
        .filter((t): t is number => typeof t === "number");
      const latestTrialEnd =
        trialEnds.length > 0 ? new Date(Math.max(...trialEnds)) : null;

      const planChanged = bestPlan !== u.plan;
      const trialChanged =
        (latestTrialEnd?.getTime() ?? null) !==
        (u.trialEndsAt?.getTime() ?? null);

      if (!planChanged && !trialChanged) continue;

      await prisma.user.update({
        where: { id: u.id },
        data: {
          ...(planChanged ? { plan: bestPlan } : {}),
          ...(trialChanged ? { trialEndsAt: latestTrialEnd } : {}),
        },
      });

      if (planChanged) userPlanUpdates += 1;
      if (trialChanged) userTrialUpdates += 1;
    }

    // --- Pass 2: Subscription.userId from the workspace's OWNER ------

    const subs = await prisma.subscription.findMany({
      where: { userId: null },
      select: {
        id: true,
        orgId: true,
        organization: {
          select: {
            memberships: {
              where: { role: "OWNER" },
              take: 1,
              select: { userId: true },
            },
          },
        },
      },
    });

    let subscriptionUpdates = 0;
    for (const s of subs) {
      const ownerId = s.organization.memberships[0]?.userId;
      if (!ownerId) continue;
      await prisma.subscription.update({
        where: { id: s.id },
        data: { userId: ownerId },
      });
      subscriptionUpdates += 1;
    }

    return NextResponse.json({
      ok: true,
      summary: {
        usersConsidered: users.length,
        userPlanUpdates,
        userTrialUpdates,
        subscriptionsConsidered: subs.length,
        subscriptionUpdates,
      },
    });
  } catch (error) {
    await reportError(error, { op: "admin.backfill-user-plan" });
    return NextResponse.json(
      { error: "Backfill failed; see logs" },
      { status: 500 }
    );
  }
}
