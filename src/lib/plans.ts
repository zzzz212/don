export const PLANS = ["FREE", "PRO", "BUSINESS"] as const;
export type Plan = (typeof PLANS)[number];

export const DEFAULT_PLAN: Plan = "FREE";

export type QuotaFeature = "analyze" | "generate" | "chat";

export const UNLIMITED = Number.POSITIVE_INFINITY;

interface PlanLimits {
  analyze: number;
  generate: number;
  chat: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE: {
    analyze: 3,
    generate: 2,
    chat: UNLIMITED,
  },
  PRO: {
    analyze: UNLIMITED,
    generate: UNLIMITED,
    chat: UNLIMITED,
  },
  BUSINESS: {
    analyze: UNLIMITED,
    generate: UNLIMITED,
    chat: UNLIMITED,
  },
};

export function normalizePlan(plan: string | null | undefined): Plan {
  if (plan && (PLANS as readonly string[]).includes(plan)) {
    return plan as Plan;
  }
  return DEFAULT_PLAN;
}

export function getPlanLimits(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
}

export function isUnlimited(value: number): boolean {
  return !Number.isFinite(value);
}
