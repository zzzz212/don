// Referral programme. A user shares their code; when someone who signed
// up with it activates the trial, both sides get a lifetime pool of
// bonus FREE analyses (User.bonusAnalyses).
//
// Tying the payout to trial activation — not to signup — keeps it honest:
// activation runs through the layered anti-abuse checks (disposable
// email, normalised-email dedup, device clustering), so fake referrals
// are already hard to mass-produce.

import { prisma } from "@/lib/db";
import { getPlanLimits } from "@/lib/plans";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { buildReferralRewardEmail } from "@/lib/email/templates/referral-reward";
import { BRAND } from "@/lib/legal-info";
import { reportError } from "@/lib/telemetry";

/** Bonus analyses each side earns per successful referral. */
export const REFERRAL_BONUS = 3;

// No ambiguous characters (I/O/0/1) — codes get read aloud and typed.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LEN = 7;

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LEN));
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    out += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return out;
}

/**
 * A fresh, collision-free referral code. Uniqueness is enforced here in
 * code rather than as a DB constraint (foot-gun #2 — a nullable unique
 * blocks `prisma db push`); the @@index keeps the check cheap.
 */
export async function generateReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomCode();
    const clash = await prisma.user.findFirst({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!clash) return code;
  }
  // 32^7 space — getting here means something is very wrong; extend it.
  return `${randomCode()}${randomCode().slice(0, 3)}`;
}

/** Resolve a referral code to the inviting user's id, or null. */
export async function resolveReferralCode(
  code: string
): Promise<string | null> {
  const normalized = code.trim().toUpperCase();
  if (normalized.length === 0) return null;
  const user = await prisma.user.findFirst({
    where: { referralCode: normalized },
    select: { id: true },
  });
  return user?.id ?? null;
}

/**
 * Pay out a referral. Called once, when a referred user activates their
 * trial. Both the referred user and their referrer get REFERRAL_BONUS
 * analyses. Never throws — a referral payout must not break activation.
 */
export async function grantReferralReward(
  refereeUserId: string
): Promise<void> {
  try {
    const referee = await prisma.user.findUnique({
      where: { id: refereeUserId },
      select: { id: true, referredById: true, name: true },
    });
    if (!referee?.referredById) return;

    const referrer = await prisma.user.findUnique({
      where: { id: referee.referredById },
      select: { id: true, email: true },
    });
    if (!referrer) return;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: referee.id },
        data: { bonusAnalyses: { increment: REFERRAL_BONUS } },
      }),
      prisma.user.update({
        where: { id: referrer.id },
        data: { bonusAnalyses: { increment: REFERRAL_BONUS } },
      }),
    ]);

    void logAudit({
      orgId: null,
      userId: referrer.id,
      action: "referral.rewarded",
      target: referee.id,
      targetType: "user",
      payload: { bonus: REFERRAL_BONUS },
    });

    if (referrer.email) {
      void sendEmail(
        buildReferralRewardEmail({
          to: referrer.email,
          friendName: referee.name,
          bonus: REFERRAL_BONUS,
          referralUrl: `${BRAND.publicUrl}/referral`,
        })
      );
    }
  } catch (e) {
    await reportError(e, { op: "referral.reward" });
  }
}

/**
 * Draw one credit from the workspace owner's bonus pool when their
 * just-completed analysis went past the monthly FREE allowance. Called
 * (awaited) at the end of a successful /api/analyze. Never throws.
 */
export async function consumeReferralBonus(orgId: string): Promise<void> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        memberships: {
          where: { role: "OWNER" },
          take: 1,
          select: {
            user: { select: { id: true, plan: true, bonusAnalyses: true } },
          },
        },
      },
    });
    const owner = org?.memberships[0]?.user;
    if (!owner || owner.plan !== "FREE" || owner.bonusAnalyses <= 0) return;

    const base = getPlanLimits("FREE").analyze;
    if (typeof base !== "number") return;

    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    );
    const used = await prisma.aiUsage.count({
      where: { orgId, feature: "analyze", createdAt: { gte: monthStart } },
    });
    // Past the free base ⇒ this analysis was covered by the bonus pool.
    if (used > base) {
      await prisma.user.update({
        where: { id: owner.id },
        data: { bonusAnalyses: { decrement: 1 } },
      });
    }
  } catch (e) {
    await reportError(e, { op: "referral.consume" });
  }
}
