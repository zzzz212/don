export const PLANS = ["FREE", "PRO", "BUSINESS"] as const;
export type Plan = (typeof PLANS)[number];

export const DEFAULT_PLAN: Plan = "FREE";

export type QuotaFeature = "analyze" | "generate" | "chat" | "ocr";

export const UNLIMITED = Number.POSITIVE_INFINITY;

interface PlanLimits {
  analyze: number;
  generate: number;
  chat: number;
  ocr: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE: {
    analyze: 3,
    generate: 2,
    chat: UNLIMITED,
    ocr: 0, // OCR is gated on paid tiers — most expensive operation
  },
  PRO: {
    analyze: UNLIMITED,
    generate: UNLIMITED,
    chat: UNLIMITED,
    ocr: UNLIMITED,
  },
  BUSINESS: {
    analyze: UNLIMITED,
    generate: UNLIMITED,
    chat: UNLIMITED,
    ocr: UNLIMITED,
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

// ── Trial-aware effective plan resolution ──────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface PlanContext {
  /** Raw `plan` column from Organization. */
  plan: string | null | undefined;
  /** Trial end timestamp, or null if no trial was ever granted. */
  trialEndsAt?: Date | null;
}

export interface EffectivePlan {
  /** Plan to use for feature/limit lookups (PRO during active trial). */
  plan: Plan;
  /** Plan the org will fall back to once the trial expires. */
  baselinePlan: Plan;
  /** True when `plan` differs from `baselinePlan` because of an active trial. */
  isTrial: boolean;
  /** Trial end timestamp (passed through for UI display). */
  trialEndsAt: Date | null;
  /**
   * Whole days remaining in the trial, rounded up. Null when not on trial.
   * 0 means the trial expires today.
   */
  trialDaysLeft: number | null;
}

/**
 * Resolve the effective plan for an Organization, taking the trial window
 * into account. During the trial: returns PRO regardless of stored plan;
 * outside it: returns the stored plan as-is. Pure function — `now` is
 * injected for deterministic testing.
 *
 * NOTE: as of the user-level-plan rollout this is now a thin shim — the
 * ergonomic input is User { plan, trialEndsAt }. We keep this signature
 * because every legacy caller already passes Org-shaped objects; new
 * callers should prefer getEffectiveUserPlan().
 */
export function getEffectivePlan(
  ctx: PlanContext,
  now: Date = new Date()
): EffectivePlan {
  const baselinePlan = normalizePlan(ctx.plan);

  if (
    baselinePlan === "FREE" &&
    ctx.trialEndsAt &&
    ctx.trialEndsAt.getTime() > now.getTime()
  ) {
    const remainingMs = ctx.trialEndsAt.getTime() - now.getTime();
    const trialDaysLeft = Math.max(0, Math.ceil(remainingMs / MS_PER_DAY));
    return {
      plan: "PRO",
      baselinePlan,
      isTrial: true,
      trialEndsAt: ctx.trialEndsAt,
      trialDaysLeft,
    };
  }

  return {
    plan: baselinePlan,
    baselinePlan,
    isTrial: false,
    trialEndsAt: ctx.trialEndsAt ?? null,
    trialDaysLeft: null,
  };
}

// ── User-level plan (new authoritative path) ───────────────────────────

export interface UserPlanContext {
  /** Raw `plan` column from User. */
  plan: string | null | undefined;
  /** User-level trial end timestamp, or null if no trial was ever granted. */
  trialEndsAt?: Date | null;
}

/**
 * Same shape as getEffectivePlan, but reads from a User row. This is the
 * authoritative path post-rollout: plan and trial belong to the user
 * account, and the same tier applies across every workspace they own.
 */
export function getEffectiveUserPlan(
  ctx: UserPlanContext,
  now: Date = new Date()
): EffectivePlan {
  // Same shape, same logic — the only difference is which row we read.
  // Keeping this as a separate name so call-sites are explicit about
  // "this is the user-level decision, not the workspace-level one".
  return getEffectivePlan(ctx, now);
}
