// Time-based One-Time Password (TOTP) helpers — RFC 6238.
//
// Backed by `otplib` v13's functional API (the v12 `authenticator`
// singleton was removed). Settings:
//   • 6-digit codes (industry default — Google Authenticator, Authy)
//   • 30-second period (default)
//   • epochTolerance: 1 — accept codes from previous, current, and next
//     time step. Saves the user when their clock drifts a few seconds.
//
// Recovery codes are 8 hex chars dash-grouped ("a1b2-c3d4"). Stored as
// SHA-256 hashes — original is shown to the user exactly once at setup.

import {
  generateSecret as otpGenerateSecret,
  generateURI,
  generateSync,
  verifySync,
} from "otplib";
import { createHash, randomBytes } from "node:crypto";
import { BRAND } from "@/lib/legal-info";

const TOTP_OPTIONS = {
  strategy: "totp" as const,
  algorithm: "sha1" as const,
  digits: 6,
  period: 30,
  // ±1 step (= ±30s) tolerance
  epochTolerance: 1,
};

const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_BYTES = 4; // 4 bytes = 8 hex chars

/** Base32-encoded random secret. */
export function generateTotpSecret(): string {
  return otpGenerateSecret({ length: 20 });
}

/**
 * Build the otpauth:// URI an authenticator app (Google Authenticator,
 * Authy, 1Password, Bitwarden) can scan as a QR code. Includes issuer
 * (BRAND.name) so the entry shows up clearly in the app.
 */
export function buildOtpauthUri(secret: string, accountLabel: string): string {
  return generateURI({
    strategy: "totp",
    issuer: BRAND.name,
    label: accountLabel,
    secret,
    algorithm: "sha1",
    digits: 6,
    period: 30,
  });
}

/**
 * Generate a TOTP for the given secret RIGHT NOW. Used in tests; never
 * called from production code (servers verify, they don't generate).
 */
export function generateTotpForTesting(secret: string): string {
  return generateSync({ ...TOTP_OPTIONS, secret });
}

/** Verify a 6-digit code against the secret. */
export function verifyTotpCode(token: string, secret: string): boolean {
  const cleaned = token.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  try {
    // otplib v13 returns VerifyResult — { valid: true, ... } or
    // { valid: false, ... }. Coerce to plain boolean for our caller.
    const result = verifySync({ ...TOTP_OPTIONS, secret, token: cleaned });
    return result.valid === true;
  } catch {
    return false;
  }
}

// ── Recovery codes ───────────────────────────────────────────────

/**
 * Generate N fresh recovery codes. Returns BOTH the plaintext (to show
 * the user once) and their SHA-256 hashes (to store in DB). Caller MUST
 * persist hashes immediately.
 */
export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): {
  plaintext: string[];
  hashed: string[];
} {
  const plaintext: string[] = [];
  const hashed: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = randomBytes(RECOVERY_CODE_BYTES).toString("hex");
    const formatted = `${raw.slice(0, 4)}-${raw.slice(4)}`;
    plaintext.push(formatted);
    hashed.push(hashRecoveryCode(formatted));
  }
  return { plaintext, hashed };
}

/** SHA-256 of a recovery code (with whitespace/dash normalized). */
export function hashRecoveryCode(code: string): string {
  const normalized = code.toLowerCase().replace(/[\s-]+/g, "");
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Match a candidate recovery code against the stored hashes. Returns the
 * remaining list (with the matched hash removed) on success, or null on
 * miss. Constant-time scan — we always compare against every stored hash.
 */
export function consumeRecoveryCode(
  candidate: string,
  storedHashes: string[]
): string[] | null {
  const target = hashRecoveryCode(candidate);
  let matchedIdx = -1;
  for (let i = 0; i < storedHashes.length; i++) {
    if (timingSafeEqualHex(storedHashes[i], target) && matchedIdx === -1) {
      matchedIdx = i;
    }
  }
  if (matchedIdx === -1) return null;
  const remaining = [...storedHashes];
  remaining.splice(matchedIdx, 1);
  return remaining;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
