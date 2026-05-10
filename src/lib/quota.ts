// Workspace-scoped USAGE counter, USER-scoped plan/quota tier.
//
// Usage rows live on AiUsage.orgId (so we can show "the team consumed
// X this month"), but the limit attached to a workspace is determined
// by the OWNER's User.plan — a team's plan follows the seat that bought
// the subscription, not the workspace itself. A user with PRO has PRO
// quotas in every workspace they own, free or paid.
//
// All routes call checkQuotaSafe(orgId, feature) right after auth + role
// resolution. Anonymous (no orgId) calls bypass quota entirely.

import { prisma } from "@/lib/db";
import {
  getEffectiveUserPlan,
  getPlanLimits,
  isUnlimited,
  type QuotaFeature,
} from "@/lib/plans";

export interface QuotaStatus {
  feature: QuotaFeature;
  used: number;
  limit: number;
  unlimited: boolean;
  allowed: boolean;
  resetsAt: Date;
  /** Effective plan applied for the limit (PRO during an active trial). */
  plan: string;
  /** True when the limit comes from a trial — surface this in upgrade UX. */
  isTrial: boolean;
  /** Days remaining in the trial; null when not on trial. */
  trialDaysLeft: number | null;
  orgId: string;
}

function startOfMonthUtc(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfNextMonthUtc(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

export async function getOrgUsageThisMonth(
  orgId: string,
  feature: QuotaFeature
): Promise<number> {
  return prisma.aiUsage.count({
    where: {
      orgId,
      feature,
      createdAt: { gte: startOfMonthUtc() },
    },
  });
}

/**
 * Resolve the user whose plan governs this workspace. We use the OWNER
 * membership — the seat that pays. If no OWNER row exists (e.g. a
 * legacy org from before workspaces), fall back to any membership and
 * finally to the workspace itself (preserves old behaviour).
 */
async function resolvePlanContextForOrg(orgId: string): Promise<{
  plan: string;
  trialEndsAt: Date | null;
}> {
  // Single round-trip: fetch the org with the owner row joined in.
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      plan: true,
      trialEndsAt: true,
      memberships: {
        where: { role: "OWNER" },
        take: 1,
        select: {
          user: {
            select: { plan: true, trialEndsAt: true },
          },
        },
      },
    },
  });

  if (!org) {
    return { plan: "FREE", trialEndsAt: null };
  }

  const owner = org.memberships[0]?.user;
  if (owner) {
    return {
      plan: owner.plan,
      trialEndsAt: owner.trialEndsAt ?? null,
    };
  }

  // Pre-workspaces fallback — read the legacy fields on the org row.
  return {
    plan: org.plan,
    trialEndsAt: org.trialEndsAt ?? null,
  };
}

export async function checkQuota(
  orgId: string,
  feature: QuotaFeature
): Promise<QuotaStatus> {
  const ctx = await resolvePlanContextForOrg(orgId);

  const effective = getEffectiveUserPlan({
    plan: ctx.plan,
    trialEndsAt: ctx.trialEndsAt,
  });
  const limit = getPlanLimits(effective.plan)[feature];
  const resetsAt = startOfNextMonthUtc();

  const base = {
    feature,
    plan: effective.plan,
    isTrial: effective.isTrial,
    trialDaysLeft: effective.trialDaysLeft,
    orgId,
  } as const;

  if (isUnlimited(limit)) {
    return {
      ...base,
      used: 0,
      limit,
      unlimited: true,
      allowed: true,
      resetsAt,
    };
  }

  const used = await getOrgUsageThisMonth(orgId, feature);

  return {
    ...base,
    used,
    limit,
    unlimited: false,
    allowed: used < limit,
    resetsAt,
  };
}

export async function checkQuotaSafe(
  orgId: string | null | undefined,
  feature: QuotaFeature
): Promise<QuotaStatus | null> {
  if (!orgId) return null;
  try {
    return await checkQuota(orgId, feature);
  } catch (e) {
    console.error("[quota] check failed (fail-open):", (e as Error).message);
    return null;
  }
}
