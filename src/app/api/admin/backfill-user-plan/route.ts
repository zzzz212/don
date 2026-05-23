import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { reportError } from "@/lib/telemetry";

// POST /api/admin/backfill-user-plan
//
// Idempotent maintenance endpoint with three passes:
//
//   1. User.plan / User.trialEndsAt — backfill from owned Organizations
//      for legacy users whose User.plan was never set after the
//      user-level-plan rollout. Picks the best plan across owned
//      workspaces.
//   2. Subscription.userId — fill in the new authoritative FK from
//      Subscription→Organization→OWNER membership.
//   3. Plan-string rename — migrate legacy "PRO" → "PRO_SOLO" across
//      User, Organization, Subscription, and Payment. After the 5-tier
//      rollout PRO is an alias for PRO_SOLO at the type level
//      (normalizePlan handles read-time fallback), but admin tables and
//      reports look cleaner when the canonical string is stored. Safe
//      because every consumer was already taught to accept PRO; the
//      rename just commits to one spelling.
//
// All three passes are idempotent — re-running picks no-op.
//
// Auth: x-admin-key header must match ADMIN_SEED_KEY (default
// "dev-seed-key" for local). Same gate the other admin routes use.

// Plan rank including the new tiers. Higher = better.
const PLAN_RANK: Record<string, number> = {
  FREE: 0,
  PRO: 1, // legacy alias — same rank as PRO_SOLO
  PRO_SOLO: 1,
  PRO_TEAM: 2,
  BUSINESS: 3,
};
const RANK_PLAN: Record<number, string> = {
  0: "FREE",
  1: "PRO_SOLO",
  2: "PRO_TEAM",
  3: "BUSINESS",
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

      // Treat legacy "PRO" on the user row as "PRO_SOLO" for the
      // "does this need updating?" comparison — otherwise we'd rewrite
      // it every run.
      const currentNormalised = u.plan === "PRO" ? "PRO_SOLO" : u.plan;
      const planChanged = bestPlan !== currentNormalised;
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

    // --- Pass 3: Rename legacy "PRO" → "PRO_SOLO" everywhere --------
    //
    // Done as a Prisma updateMany on each table; we don't need to
    // touch any business logic because normalizePlan + PLAN_LABEL +
    // isPaidPlan all already treat "PRO" and "PRO_SOLO" as equivalent.
    // The rename is purely cosmetic — admin tables and reports look
    // cleaner with one canonical string.
    const userPlanRename = await prisma.user.updateMany({
      where: { plan: "PRO" },
      data: { plan: "PRO_SOLO" },
    });
    const orgPlanRename = await prisma.organization.updateMany({
      where: { plan: "PRO" },
      data: { plan: "PRO_SOLO" },
    });
    const subPlanRename = await prisma.subscription.updateMany({
      where: { plan: "PRO" },
      data: { plan: "PRO_SOLO" },
    });
    // Payments are historical receipts — we leave them as-is so that
    // re-replaying a 2025 receipt still says "PRO" for the audit trail.
    // PaidPlan type tolerates both spellings.

    return NextResponse.json({
      ok: true,
      summary: {
        usersConsidered: users.length,
        userPlanUpdates,
        userTrialUpdates,
        subscriptionsConsidered: subs.length,
        subscriptionUpdates,
        legacyProRenames: {
          users: userPlanRename.count,
          organizations: orgPlanRename.count,
          subscriptions: subPlanRename.count,
        },
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
