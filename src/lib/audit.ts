// Audit log — one row per security/billing-relevant action.
//
// What goes in:
//   • Workspace membership changes (invites, removals, role changes)
//   • Billing actions (checkout, success, refund, manual plan flip)
//   • Trial events (activated, extended)
//   • Document deletions (auditable per 152-ФЗ)
//   • Auth security (2FA enabled/disabled, password changed)
//   • Admin actions (when an admin acts on a user's behalf)
//
// What does NOT go in:
//   • User reads (analyses, chat messages, page views) — that's analytics
//   • Document content / message text / emails / names — PII-free by
//     contract. The redact() helper strips known sensitive keys before
//     the insert.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { reportError } from "@/lib/telemetry";

export type AuditAction =
  // Workspace lifecycle
  | "workspace.created"
  | "workspace.deleted"
  | "workspace.renamed"
  // Membership
  | "member.invited"
  | "member.invite_revoked"
  | "member.invite_accepted"
  | "member.removed"
  | "member.left"
  | "member.role_changed"
  // Billing
  | "billing.checkout_started"
  | "billing.payment_succeeded"
  | "billing.payment_failed"
  | "billing.subscription_canceled"
  | "billing.plan_changed_manually"
  // Trial
  | "trial.activated"
  | "trial.extended"
  // Documents
  | "document.deleted"
  | "document.refined_ai"
  // Account security
  | "auth.password_reset"
  | "auth.2fa_enabled"
  | "auth.2fa_disabled";

export type TargetType =
  | "workspace"
  | "membership"
  | "invite"
  | "payment"
  | "subscription"
  | "document"
  | "version"
  | "user";

interface LogArgs {
  /** Org affected. Null for user-level events (2FA, password). */
  orgId: string | null;
  /** Actor — who initiated the action. ALWAYS required. */
  userId: string;
  action: AuditAction;
  target?: string;
  targetType?: TargetType;
  /** Free-form context. Sensitive fields stripped via redact(). */
  payload?: Record<string, unknown>;
  /** Best-effort from x-forwarded-for / x-real-ip headers. */
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Persist an audit event. Never throws — failures go to Sentry as
 * op:audit.log so a broken audit pipeline can't break the user-facing
 * action. The action's primary effect commits via its own transaction;
 * audit is a side-effect, fire-and-forget.
 */
export async function logAudit(args: LogArgs): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        orgId: args.orgId,
        userId: args.userId,
        action: args.action,
        target: args.target ?? null,
        targetType: args.targetType ?? null,
        payload: args.payload
          ? (redact(args.payload) as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        ip: args.ip ?? null,
        userAgent: args.userAgent ? args.userAgent.slice(0, 500) : null,
      },
    });
  } catch (e) {
    await reportError(e, {
      op: "audit.log",
      tags: { action: args.action },
      extra: { orgId: args.orgId, target: args.target },
    });
  }
}

// ── Redaction ───────────────────────────────────────────────────

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordHash",
  "secret",
  "totpSecret",
  "secretKey",
  "apiKey",
  "token",
  "accessToken",
  "refreshToken",
  "creditCard",
  "cardNumber",
  "cvv",
  "email",
  "phone",
]);

/**
 * Recursively strip known sensitive fields from a payload object.
 * Replaces values with `"[redacted]"`. Defensive — even if a caller
 * accidentally passes an email, it doesn't land in the audit table.
 */
function redact(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key)) {
      out[key] = "[redacted]";
    } else {
      out[key] = redact(v);
    }
  }
  return out;
}

/** Exported for tests. */
export { redact as _redactForTests };

// ── Request-header attribution helper ───────────────────────────

/**
 * Extract IP and User-Agent from a Request — pass directly into logAudit
 * so callers don't have to repeat the same boilerplate everywhere.
 */
export function attribution(request: Request): {
  ip: string | null;
  userAgent: string | null;
} {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null;
  const userAgent = request.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}
