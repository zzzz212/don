// Dev/test fallback. When RESEND_API_KEY isn't configured we don't want to
// crash sign-ups or invites — we just log the email and pretend it sent so
// the rest of the flow can be exercised end-to-end against a dev DB.

import type { EmailMessage, EmailProvider, EmailSendResult } from "./provider";

export class NoopEmailProvider implements EmailProvider {
  readonly name = "noop" as const;

  async send(message: EmailMessage): Promise<EmailSendResult> {
    console.warn(
      `[email:noop] would send "${message.subject}" to ${message.to}` +
        (message.tag ? ` (tag=${message.tag})` : "") +
        " — set RESEND_API_KEY to enable real delivery"
    );
    return { ok: true, noop: true };
  }
}
