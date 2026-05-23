// Password reset core logic. Consumed by server actions in auth-actions.ts;
// kept separate so it can be unit-tested without an HTTP / NextAuth
// fixture.

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { buildPasswordResetEmail } from "@/lib/email/templates/password-reset";

const TOKEN_BYTES = 32; // 256 bits, hex-encoded → 64-char URL token
const VALIDITY_MS = 30 * 60 * 1000; // 30 minutes
export const PASSWORD_RESET_VALIDITY_HUMAN = "30 минут";
export const MIN_PASSWORD_LEN = 6;

export type ConsumeFailure =
  | "INVALID"
  | "EXPIRED"
  | "ALREADY_USED"
  | "WEAK_PASSWORD";

export interface ConsumeResult {
  ok: boolean;
  reason?: ConsumeFailure;
}

export function hashResetToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

function generatePlaintextToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

/**
 * Build the absolute URL the recipient clicks. We always use HTTPS in
 * production; in dev the caller passes its own origin (http://localhost:3000).
 */
function buildResetUrl(baseUrl: string, plaintextToken: string): string {
  return new URL(
    `/password-reset?token=${encodeURIComponent(plaintextToken)}`,
    baseUrl
  ).toString();
}

/**
 * Initiate a password reset for the email if it belongs to a registered
 * user. Always resolves successfully — the response shape never leaks
 * whether the email exists. Existing unused tokens for the user are
 * invalidated, so a stolen earlier email can't be used after a re-request.
 */
export async function requestPasswordReset(
  email: string,
  baseUrl: string
): Promise<{ ok: true }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { ok: true };

  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true, email: true, password: true },
  });

  // Privacy: don't reveal whether the email is registered. Also: skip
  // reset for accounts created via OAuth-only (no password set) — those
  // recover access by re-signing-in with the OAuth provider.
  if (!user || !user.password) {
    return { ok: true };
  }

  // Burn prior unused tokens so an earlier-sent email can't still work
  // after the user re-requests (e.g. if they thought the first didn't
  // arrive).
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const plaintext = generatePlaintextToken();
  const tokenHash = hashResetToken(plaintext);
  const expiresAt = new Date(Date.now() + VALIDITY_MS);

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  await sendEmail(
    buildPasswordResetEmail({
      to: user.email,
      resetUrl: buildResetUrl(baseUrl, plaintext),
      validityHuman: PASSWORD_RESET_VALIDITY_HUMAN,
    })
  );

  return { ok: true };
}

/**
 * Verify a password-reset token and replace the user's password if valid.
 * On success the token is marked `usedAt = now()` in the same transaction
 * as the password update — replays of the same email become no-ops.
 */
export async function consumePasswordResetToken(
  plaintextToken: string,
  newPassword: string
): Promise<ConsumeResult> {
  if (!newPassword || newPassword.length < MIN_PASSWORD_LEN) {
    return { ok: false, reason: "WEAK_PASSWORD" };
  }
  if (!plaintextToken) {
    return { ok: false, reason: "INVALID" };
  }

  const tokenHash = hashResetToken(plaintextToken);
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!row) return { ok: false, reason: "INVALID" };
  if (row.usedAt) return { ok: false, reason: "ALREADY_USED" };
  if (row.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "EXPIRED" };
  }

  const newHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { password: newHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    // Invalidate any other unused tokens for this user — once the
    // password is changed, every prior reset link should die. (Same
    // user might have requested multiple, only one consumed.)
    prisma.passwordResetToken.updateMany({
      where: {
        userId: row.userId,
        usedAt: null,
        id: { not: row.id },
      },
      data: { usedAt: new Date() },
    }),
  ]);

  return { ok: true };
}
