// Resend implementation of EmailProvider. Lazy-loads the Resend client so
// the rest of the codebase can `import` from `@/lib/email` without pulling
// in the SDK during unit tests that don't actually send mail.

import type { EmailMessage, EmailProvider, EmailSendResult } from "./provider";
import { CONTACTS, BRAND } from "@/lib/legal-info";

interface ResendClient {
  emails: {
    send(payload: {
      from: string;
      to: string;
      subject: string;
      html: string;
      text: string;
      reply_to?: string;
      tags?: { name: string; value: string }[];
    }): Promise<{ data: { id: string } | null; error: { message: string } | null }>;
  };
}

let cachedClient: ResendClient | null = null;

async function getClient(apiKey: string): Promise<ResendClient> {
  if (cachedClient) return cachedClient;
  const { Resend } = await import("resend");
  cachedClient = new Resend(apiKey) as unknown as ResendClient;
  return cachedClient;
}

function fromAddress(): string {
  // Allow override (so a sandbox/staging env can use Resend's
  // `onboarding@resend.dev` until the real domain is verified) but default
  // to the brand no-reply address for production-ready output.
  return process.env.RESEND_FROM_ADDRESS ?? `${BRAND.name} <${CONTACTS.noReply}>`;
}

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend" as const;
  constructor(private readonly apiKey: string) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const client = await getClient(this.apiKey);
      const { data, error } = await client.emails.send({
        from: fromAddress(),
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: message.replyTo ?? CONTACTS.support,
        tags: message.tag
          ? [{ name: "template", value: message.tag }]
          : undefined,
      });

      if (error) {
        return { ok: false, error: error.message };
      }
      return { ok: true, id: data?.id };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown email error",
      };
    }
  }
}
