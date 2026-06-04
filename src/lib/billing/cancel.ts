// Pure decision helpers for self-serve subscription cancellation.
//
// Two independent decisions live here so they can be unit-tested without
// a DB (vitest excludes src/app, and these are the only parts of the
// cancel flow that carry real risk):
//
//   1. canCancelSubscription — "is this sub in a state a user may cancel?"
//      Drives the POST /api/billing/cancel guard AND the /billing toggle.
//   2. resolveExpiryDowngrade — "has a canceled paid period elapsed, so
//      the user must drop to FREE now?" Drives the lazy expiry-downgrade
//      that runs on every billing-status read (no renewal-cron yet).
//
// We deliberately DON'T model auto-renew/charging here — YooKassa
// Автоплатежи isn't activated and can't be tested end-to-end, so the
// renew half of MON-3 is deferred (see roadmap §MON-3).

/** Minimal subscription shape the cancel decision needs. */
export interface CancelableSubscription {
  /** "ACTIVE" | "CANCELED" | "PAST_DUE" — see Subscription.status. */
  status: string;
  cancelAtPeriodEnd: boolean;
}

export type CancelRejection =
  | "NO_SUBSCRIPTION"
  | "ALREADY_SCHEDULED"
  | "NOT_ACTIVE";

export type CancelDecision =
  | { ok: true }
  | { ok: false; reason: CancelRejection };

/**
 * Decide whether the owner may schedule a cancel-at-period-end. We only
 * touch ACTIVE subscriptions that aren't already scheduled — the access
 * stays until currentPeriodEnd, so there is nothing to "cancel" on a row
 * that is already CANCELED, and re-scheduling is a no-op the UI should
 * surface as "already scheduled" rather than a spurious success.
 */
export function canCancelSubscription(
  sub: CancelableSubscription | null
): CancelDecision {
  if (!sub) return { ok: false, reason: "NO_SUBSCRIPTION" };
  if (sub.status !== "ACTIVE") return { ok: false, reason: "NOT_ACTIVE" };
  if (sub.cancelAtPeriodEnd) {
    return { ok: false, reason: "ALREADY_SCHEDULED" };
  }
  return { ok: true };
}

/** Subscription fields the expiry decision reads. */
export interface ExpirableSubscription {
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date;
}

export interface ExpiryDecision {
  /** True iff the user must be downgraded to FREE right now. */
  downgrade: boolean;
}

/**
 * Decide whether a canceled subscription's paid period has elapsed and
 * the user should drop to FREE. Pure — `now` injected for deterministic
 * tests, mirrors getEffectivePlan(ctx, now).
 *
 * Guards:
 *   • only ACTIVE rows scheduled to cancel are candidates — a row that
 *     already flipped to CANCELED was downgraded on a previous pass, and
 *     re-evaluating it must be a no-op (idempotent across repeated reads);
 *   • a non-canceled ACTIVE sub past its end is the (future) renewal
 *     cron's job, NEVER ours — we must not strip a paying user who simply
 *     hasn't been re-charged yet;
 *   • the boundary instant counts as not-yet-expired (access through the
 *     last paid moment).
 */
export function resolveExpiryDowngrade(
  sub: ExpirableSubscription | null,
  now: Date = new Date()
): ExpiryDecision {
  if (!sub) return { downgrade: false };
  if (sub.status !== "ACTIVE") return { downgrade: false };
  if (!sub.cancelAtPeriodEnd) return { downgrade: false };
  // Boundary is inclusive of access: the user keeps the plan through the
  // last paid instant, so only a period end strictly in the past expires.
  if (sub.currentPeriodEnd.getTime() >= now.getTime()) {
    return { downgrade: false };
  }
  return { downgrade: true };
}
