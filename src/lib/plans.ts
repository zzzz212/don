// Tier and quota definitions. Centralised here so changing a limit is
// a one-file edit and getEffectiveUserPlan / checkQuotaSafe pick it up
// automatically.
//
// Tier layout (post 5-tier rollout):
//   FREE       — evaluation. Capped, runs on Haiku.
//   PRO_SOLO   — 1 990₽/мес. Individual / ИП. 100 analyses / month.
//   PRO_TEAM   — 4 990₽/мес. Up to 5 seats, 500 analyses / month.
//                Seat enforcement is informational for now — the
//                multi-seat billing path isn't built yet; quota still
//                applies per-OWNER as it did pre-rollout.
//   BUSINESS   — 14 990₽/мес. Unlimited usage + Opus on analyze.
//
// Legacy "PRO" rows from before the rollout are aliased to PRO_SOLO via
// normalizePlan() so existing subscriptions keep working without a
// breaking backfill. Admins can rename them through the admin user
// detail page; a one-shot backfill endpoint will follow.

export const PLANS = [
  "FREE",
  "PRO_SOLO",
  "PRO_TEAM",
  "BUSINESS",
] as const;
export type Plan = (typeof PLANS)[number];

export const DEFAULT_PLAN: Plan = "FREE";

// Strings we accept on the wire that aren't canonical Plan values. Map
// to the canonical plan they should resolve to. Keeps existing rows
// behaving correctly without a destructive backfill.
const PLAN_ALIASES: Record<string, Plan> = {
  PRO: "PRO_SOLO",
};

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
    // Bumped from 3/2 with the Haiku switch — running 10 free analyses
    // on Haiku 4.5 costs roughly the same ($0.02 × 10 = $0.20) as the
    // old 3 analyses on Sonnet ($0.15 × 3 = $0.45), and 10 is closer
    // to "enough to evaluate the product on a real backlog".
    analyze: 10,
    generate: 5,
    chat: UNLIMITED,
    ocr: 0, // OCR stays paid-only — most expensive operation per call
  },
  PRO_SOLO: {
    // Hard cap protects unit economics: 100 analyses × $0.15 Sonnet ≈
    // $15 variable cost against $22 revenue, leaves room for infra.
    // Heavy users hitting the cap is also a clean upsell signal to
    // PRO_TEAM or BUSINESS.
    analyze: 100,
    generate: UNLIMITED,
    chat: UNLIMITED,
    ocr: UNLIMITED,
  },
  PRO_TEAM: {
    // Pool shared across up to 5 seats. 500 / 5 = 100 per seat at full
    // utilisation, matches PRO_SOLO economics per-head.
    analyze: 500,
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
  if (!plan) return DEFAULT_PLAN;
  if ((PLANS as readonly string[]).includes(plan)) {
    return plan as Plan;
  }
  if (plan in PLAN_ALIASES) {
    return PLAN_ALIASES[plan];
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
  /** Plan to use for feature/limit lookups (PRO_SOLO during active trial). */
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
 * into account. During the trial: returns PRO_SOLO regardless of stored
 * plan; outside it: returns the stored plan (normalised) as-is.
 *
 * Pure function — `now` is injected for deterministic testing.
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
      plan: "PRO_SOLO",
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
