// Public API for transactional email. The rest of the codebase calls
// `sendEmail(buildXxxEmail(...))` and never imports the provider directly.
//
// Provider selection is driven by env: RESEND_API_KEY → Resend, otherwise
// the noop logger. The noop never errors so missing-key on dev / preview
// builds doesn't break sign-ups; the warning lands in server logs and
// Sentry breadcrumbs so you notice when it actually matters.

import type { EmailMessage, EmailProvider, EmailSendResult } from "./provider";
import { ResendEmailProvider } from "./resend";
import { NoopEmailProvider } from "./noop";
import { reportError, addBreadcrumb } from "@/lib/telemetry";

export type { EmailMessage, EmailSendResult } from "./provider";

let cachedProvider: EmailProvider | null = null;

function getProvider(): EmailProvider {
  if (cachedProvider) return cachedProvider;
  const apiKey = process.env.RESEND_API_KEY;
  cachedProvider = apiKey
    ? new ResendEmailProvider(apiKey)
    : new NoopEmailProvider();
  return cachedProvider;
}

/**
 * Send a transactional email. Never throws — failures are reported to
 * telemetry and surfaced through `result.ok = false`. Callers that depend
 * on delivery (rare: receipts, password reset) should check `result.ok`;
 * fire-and-forget callers (welcome, analysis-ready) can ignore the result.
 */
export async function sendEmail(
  message: EmailMessage
): Promise<EmailSendResult> {
  const provider = getProvider();
  await addBreadcrumb("email.send", {
    provider: provider.name,
    to: redactEmail(message.to),
    tag: message.tag,
  });

  const result = await provider.send(message);
  if (!result.ok) {
    await reportError(new Error(`email send failed: ${result.error}`), {
      op: "email.send",
      tags: { provider: provider.name, tag: message.tag ?? "" },
      extra: { to: redactEmail(message.to), subject: message.subject },
    });
  }
  return result;
}

/** Reset cached provider — used by tests so env-var changes take effect. */
export function _resetEmailProviderCacheForTests(): void {
  cachedProvider = null;
}

/**
 * Mask local-part of an address before sending it to Sentry / breadcrumbs.
 * "ivan@example.com" → "i***@example.com". The user's domain is preserved
 * because it's useful for debugging deliverability per provider.
 */
function redactEmail(addr: string): string {
  const at = addr.indexOf("@");
  if (at <= 0) return "***";
  const local = addr.slice(0, at);
  const domain = addr.slice(at);
  if (local.length <= 1) return `*${domain}`;
  return `${local[0]}***${domain}`;
}
