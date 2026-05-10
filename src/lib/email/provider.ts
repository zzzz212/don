// Provider-agnostic interface for transactional email. The rest of the app
// imports `sendEmail` from `./index` and never touches the provider directly,
// so swapping Resend for something else (Postmark / SendGrid / SMTP) is a
// one-file change.

export interface EmailMessage {
  /** Recipient address. Must be a valid email — caller is responsible. */
  to: string;
  subject: string;
  /** Pre-rendered HTML body. */
  html: string;
  /** Plain-text fallback. Required for spam-filter friendliness. */
  text: string;
  /**
   * Optional Reply-To. Defaults to CONTACTS.support so users hitting
   * "reply" in their mail client land in the support inbox.
   */
  replyTo?: string;
  /**
   * Free-form tag attached to the send for analytics in Resend.
   * Values match our internal email-template names: "welcome", "invite",
   * "password-reset", "analysis-ready", "subscription-activated".
   */
  tag?: string;
}

export interface EmailSendResult {
  /** True when the provider accepted the message (not when delivered). */
  ok: boolean;
  /** Provider-side message id, when available. Useful for support tickets. */
  id?: string;
  /** Human-readable error message when ok=false. */
  error?: string;
  /** True if the configured provider is the noop dev provider. */
  noop?: boolean;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}
