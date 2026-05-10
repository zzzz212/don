// Per-workspace plan quotas. With workspaces, plan + usage are tracked at
// the Organization level — a paying team's MEMBERS share one PRO plan, and
// a single user's "Personal workspace" is just an org-of-one.
//
// All routes call checkQuotaSafe(orgId, feature) right after auth + role
// resolution. Anonymous (no orgId) calls bypass quota entirely.

import { prisma } from "@/lib/db";
import {
  getEffectivePlan,
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

export async function checkQuota(
  orgId: string,
  feature: QuotaFeature
): Promise<QuotaStatus> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true, trialEndsAt: true },
  });

  const effective = getEffectivePlan({
    plan: org?.plan,
    trialEndsAt: org?.trialEndsAt ?? null,
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
