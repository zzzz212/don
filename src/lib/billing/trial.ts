// Manual trial activation. Used for accounts that existed BEFORE the
// trial feature shipped — for those users, ensureActiveOrg's bootstrap
// branch never re-fired (they already had a workspace) so trialEndsAt
// was never set. Without an explicit activation entry-point, those
// users would silently miss the trial forever.
//
// Newer accounts: ensureActiveOrg sets both Organization.trialEndsAt
// and User.trialActivatedAt atomically on first sign-in, so they don't
// need this code path.

import { prisma } from "@/lib/db";
import { TRIAL_DAYS } from "@/lib/legal-info";
import { getEffectivePlan } from "@/lib/plans";

export type ActivationFailure =
  | "ALREADY_ACTIVATED"
  | "WORKSPACE_NOT_FREE"
  | "WORKSPACE_NOT_FOUND"
  | "USER_NOT_FOUND";

export interface ActivationResult {
  ok: boolean;
  reason?: ActivationFailure;
  /** ISO trial-end timestamp on success. */
  trialEndsAt?: string;
}

/**
 * Pure check: can this user claim the trial right now? Used by the
 * /billing UI to decide whether to show the "Activate trial" button.
 */
export interface TrialEligibility {
  /** True iff the user has never used a trial AND owns a FREE workspace. */
  canActivate: boolean;
  /**
   * Why the user can't activate (when canActivate is false). Useful for
   * support diagnostics — UI just hides the button.
   */
  reason?:
    | "ALREADY_ACTIVATED"
    | "ALREADY_PAID_OR_TRIALING"
    | "NO_FREE_WORKSPACE";
}

export async function checkTrialEligibility(
  userId: string,
  activeOrgId: string
): Promise<TrialEligibility> {
  const [user, org] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { trialActivatedAt: true },
    }),
    prisma.organization.findUnique({
      where: { id: activeOrgId },
      select: { plan: true, trialEndsAt: true },
    }),
  ]);

  if (!user) return { canActivate: false, reason: "ALREADY_ACTIVATED" };
  if (user.trialActivatedAt) {
    return { canActivate: false, reason: "ALREADY_ACTIVATED" };
  }
  if (!org) return { canActivate: false, reason: "NO_FREE_WORKSPACE" };

  const eff = getEffectivePlan({
    plan: org.plan,
    trialEndsAt: org.trialEndsAt,
  });
  if (eff.plan !== "FREE") {
    // Already on PRO/BUSINESS or already trialing — no need for activation.
    return { canActivate: false, reason: "ALREADY_PAID_OR_TRIALING" };
  }

  return { canActivate: true };
}

/**
 * Grant the trial. Sets Organization.trialEndsAt = now + TRIAL_DAYS AND
 * User.trialActivatedAt = now in one transaction so the operation is
 * atomic — a partial commit can't leave the user "consumed" trial flag
 * without the actual benefit (or vice versa).
 */
export async function activateTrial(
  userId: string,
  orgId: string
): Promise<ActivationResult> {
  const eligibility = await checkTrialEligibility(userId, orgId);
  if (!eligibility.canActivate) {
    if (eligibility.reason === "ALREADY_ACTIVATED") {
      return { ok: false, reason: "ALREADY_ACTIVATED" };
    }
    if (eligibility.reason === "ALREADY_PAID_OR_TRIALING") {
      return { ok: false, reason: "WORKSPACE_NOT_FREE" };
    }
    return { ok: false, reason: "WORKSPACE_NOT_FOUND" };
  }

  const trialEndsAt = new Date(
    Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000
  );

  await prisma.$transaction([
    prisma.organization.update({
      where: { id: orgId },
      data: { trialEndsAt },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { trialActivatedAt: new Date() },
    }),
  ]);

  return { ok: true, trialEndsAt: trialEndsAt.toISOString() };
}
