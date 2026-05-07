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
}

function startOfMonthUtc(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfNextMonthUtc(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

export async function getUsageThisMonth(
  userId: string,
  feature: QuotaFeature
): Promise<number> {
  return prisma.aiUsage.count({
    where: {
      userId,
      feature,
      createdAt: { gte: startOfMonthUtc() },
    },
  });
}

export async function checkQuota(
  userId: string,
  feature: QuotaFeature
): Promise<QuotaStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  const plan = normalizePlan(user?.plan);
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
    };
  }

  const used = await getUsageThisMonth(userId, feature);

  return {
    feature,
    used,
    limit,
    unlimited: false,
    allowed: used < limit,
    resetsAt,
    plan,
  };
}

export async function checkQuotaSafe(
  userId: string | null | undefined,
  feature: QuotaFeature
): Promise<QuotaStatus | null> {
  if (!userId) return null;
  try {
    return await checkQuota(userId, feature);
  } catch (e) {
    console.error("[quota] check failed (fail-open):", (e as Error).message);
    return null;
  }
}
