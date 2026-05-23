// Layered multi-account defence.
//
// The trial is one-per-user-lifetime (User.trialActivatedAt), but that
// alone doesn't stop someone registering 20 accounts. This module adds
// two more layers:
//
//   • Hard blocks at registration — disposable email domains and
//     normalised-email collisions (Gmail dots / +aliases). Low
//     false-positive risk, so we reject outright.
//   • Soft scoring at trial activation — accounts sharing a signup IP or
//     device fingerprint raise a 0–100 risk score. We do NOT auto-block
//     on these: corporate NAT and mobile carriers legitimately put many
//     real users behind one IP. High scores surface in /admin/abuse for
//     a human to review.
//
// The goal is to make farming inconvenient and visible, not to win an
// arms race.

import { createHash } from "crypto";

// ── Email helpers ───────────────────────────────────────────────────

// Common disposable / throwaway providers. Not exhaustive — a curated
// set of the most-used ones. Maintaining a perfect list is futile; this
// catches the lazy 90%.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.ru",
  "tempmail.ru",
  "throwawaymail.com",
  "getnada.com",
  "trashmail.com",
  "trashmail.net",
  "yopmail.com",
  "yopmail.net",
  "fakeinbox.com",
  "maildrop.cc",
  "dispostable.com",
  "mailnesia.com",
  "mintemail.com",
  "sharklasers.com",
  "spam4.me",
  "grr.la",
  "guerrillamailblock.com",
  "pokemail.net",
  "33mail.com",
  "tempinbox.com",
  "emailondeck.com",
  "mohmal.com",
  "tmpmail.org",
  "tmpmail.net",
  "tmail.com",
  "moakt.com",
  "mailcatch.com",
  "burnermail.io",
  "anonbox.net",
  "spamgourmet.com",
  "mailexpire.com",
  "incognitomail.com",
  "vmani.com",
  "1secmail.com",
  "1secmail.org",
  "1secmail.net",
  "dropmail.me",
  "tempr.email",
  "emltmp.com",
  "20minutemail.com",
  "mvrht.com",
  "spambox.us",
  "tempmailo.com",
  "minuteinbox.com",
]);

/** Lowercased domain part of an email, or "" when malformed. */
export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at < 0 ? "" : email.slice(at + 1).toLowerCase().trim();
}

/** True when the address belongs to a known disposable-email provider. */
export function isDisposableEmail(email: string): boolean {
  return DISPOSABLE_DOMAINS.has(emailDomain(email));
}

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/**
 * Normalised form of an email for duplicate detection. Lowercased; the
 * `+alias` suffix dropped; for Gmail the dots in the local part are also
 * dropped (Gmail ignores them, so j.o.hn@ and john@ reach one inbox).
 *
 * This is NOT the address we send mail to — it's only a dedup key.
 */
export function normalizeEmailForDedup(email: string): string {
  const trimmed = (email ?? "").trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at < 0) return trimmed;
  let local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus >= 0) local = local.slice(0, plus);
  if (GMAIL_DOMAINS.has(domain)) local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

// ── Device fingerprint ──────────────────────────────────────────────

/**
 * SHA-256 hex of a raw client fingerprint string. We never store the
 * raw composite — only this hash — so the stored value is opaque and
 * stable. An empty / missing input maps to "" (no fingerprint captured).
 */
export function hashFingerprint(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (trimmed.length === 0) return "";
  return createHash("sha256").update(trimmed).digest("hex");
}

// ── Trial-activation risk score ─────────────────────────────────────

export interface AbuseSignals {
  /** Other accounts that already activated a trial from this signup IP. */
  ipCluster: number;
  /** Other trial accounts sharing this signup device fingerprint. */
  fingerprintCluster: number;
}

export interface AbuseAssessment {
  /** 0–100. Higher = more likely a farmed multi-account. */
  score: number;
  /** Human-readable reasons, shown to admins. */
  flags: string[];
  /** True when the score warrants manual review. */
  suspicious: boolean;
}

// A device fingerprint collision between unrelated people is rare, so it
// weighs heavily. An IP collision is noisy (NAT) so it weighs little and
// only contributes once the cluster is clearly large.
const FINGERPRINT_WEIGHT = 30;
const IP_WEIGHT = 8;
const IP_CLUSTER_FLAG_MIN = 3;
export const SUSPICIOUS_THRESHOLD = 50;

/**
 * Score a trial activation against accounts that share its signup
 * signals. Pure — the caller gathers the cluster counts from the DB.
 */
export function assessAbuse(signals: AbuseSignals): AbuseAssessment {
  const fp = Math.max(0, signals.fingerprintCluster);
  const ip = Math.max(0, signals.ipCluster);

  const score = Math.min(100, fp * FINGERPRINT_WEIGHT + ip * IP_WEIGHT);

  const flags: string[] = [];
  if (fp > 0) {
    flags.push(
      `Та же сигнатура устройства, что у ${fp} ${plural(
        fp,
        "аккаунта",
        "аккаунтов",
        "аккаунтов"
      )} с триалом`
    );
  }
  if (ip >= IP_CLUSTER_FLAG_MIN) {
    flags.push(
      `Тот же IP при регистрации, что у ${ip} ${plural(
        ip,
        "аккаунта",
        "аккаунтов",
        "аккаунтов"
      )}`
    );
  }

  return { score, flags, suspicious: score >= SUSPICIOUS_THRESHOLD };
}

/** Russian plural picker — 1 аккаунт / 2 аккаунта / 5 аккаунтов. */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
