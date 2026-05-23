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
import { getEffectiveUserPlan } from "@/lib/plans";
import { assessAbuse } from "@/lib/anti-abuse";

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
  /** Multi-account risk score computed at activation (0–100). */
  abuseScore?: number;
  /** Human-readable risk flags — non-empty when the activation looks
   *  like a farmed multi-account and should be reviewed by an admin. */
  abuseFlags?: string[];
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
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { trialActivatedAt: true, plan: true, trialEndsAt: true },
  });

  if (!user) return { canActivate: false, reason: "ALREADY_ACTIVATED" };
  if (user.trialActivatedAt) {
    return { canActivate: false, reason: "ALREADY_ACTIVATED" };
  }

  // Plan / trial are user-scoped now. We don't even need to look at the
  // workspace — if the user is FREE and never trialed, they're eligible.
  // activeOrgId is still passed for backwards compatibility (and so audit
  // logs can attribute the activation to the workspace they were on).
  void activeOrgId;

  const eff = getEffectiveUserPlan({
    plan: user.plan,
    trialEndsAt: user.trialEndsAt,
  });
  if (eff.plan !== "FREE") {
    // Already on PRO/BUSINESS or already trialing — no need for activation.
    return { canActivate: false, reason: "ALREADY_PAID_OR_TRIALING" };
  }

  return { canActivate: true };
}

/**
 * Grant the trial. Atomically sets:
 *   • User.trialEndsAt = now + TRIAL_DAYS  (authoritative: the trial
 *     applies to every workspace the user owns)
 *   • User.trialActivatedAt = now           (lifetime "trial used" flag)
 *   • Organization.trialEndsAt = same       (legacy column, kept in sync
 *     so admin queries and old code keep working until a later migration
 *     drops it)
 *
 * The three writes share one transaction so a partial commit can't leave
 * the user "trial used" flag without the actual benefit (or vice versa).
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

  // ── Soft anti-abuse scoring ───────────────────────────────────────
  // Cluster this activation against accounts that already trialed from
  // the same signup IP / device fingerprint. We never auto-block here:
  // corporate NAT and mobile carriers legitimately share IPs (the user
  // chose the layered, not the strict, policy). A high score is stored
  // and surfaced in /admin/abuse for a human to review.
  const signals = await prisma.user.findUnique({
    where: { id: userId },
    select: { signupIp: true, signupFingerprint: true },
  });
  let fingerprintCluster = 0;
  let ipCluster = 0;
  if (signals?.signupFingerprint) {
    fingerprintCluster = await prisma.user.count({
      where: {
        id: { not: userId },
        signupFingerprint: signals.signupFingerprint,
        trialActivatedAt: { not: null },
      },
    });
  }
  if (signals?.signupIp) {
    ipCluster = await prisma.user.count({
      where: {
        id: { not: userId },
        signupIp: signals.signupIp,
        trialActivatedAt: { not: null },
      },
    });
  }
  const assessment = assessAbuse({ ipCluster, fingerprintCluster });

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        trialActivatedAt: now,
        trialEndsAt,
        abuseScore: assessment.score,
      },
    }),
    prisma.organization.update({
      where: { id: orgId },
      data: { trialEndsAt },
    }),
  ]);

  return {
    ok: true,
    trialEndsAt: trialEndsAt.toISOString(),
    abuseScore: assessment.score,
    abuseFlags: assessment.flags,
  };
}
