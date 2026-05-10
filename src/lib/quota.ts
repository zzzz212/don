// Per-workspace plan quotas. With workspaces, plan + usage are tracked at
// the Organization level — a paying team's MEMBERS share one PRO plan, and
// a single user's "Personal workspace" is just an org-of-one.
//
// All routes call checkQuotaSafe(orgId, feature) right after auth + role
// resolution. Anonymous (no orgId) calls bypass quota entirely.

import { prisma } from "@/lib/db";
import {
  getPlanLimits,
  isUnlimited,
  normalizePlan,
  type QuotaFeature,
} from "@/lib/plans";

export interface QuotaStatus {
  feature: QuotaFeature;
  used: number;
  limit: number;
  unlimited: boolean;
  allowed: boolean;
  resetsAt: Date;
  plan: string;
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
    select: { plan: true },
  });

  const plan = normalizePlan(org?.plan);
  const limit = getPlanLimits(plan)[feature];
  const resetsAt = startOfNextMonthUtc();

  if (isUnlimited(limit)) {
    return {
      feature,
      used: 0,
      limit,
      unlimited: true,
      allowed: true,
      resetsAt,
      plan,
      orgId,
    };
  }

  const used = await getOrgUsageThisMonth(orgId, feature);

  return {
    feature,
    used,
    limit,
    unlimited: false,
    allowed: used < limit,
    resetsAt,
    plan,
    orgId,
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
