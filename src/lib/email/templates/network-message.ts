// Sent when someone opens a new direct-message conversation. Only the
// FIRST message of a thread triggers an email — an active back-and-forth
// is handled by the in-app unread badge, not a mailbox flood.

import type { EmailMessage } from "../provider";
import { renderEmailHtml, renderEmailText } from "./layout";
import { BRAND } from "@/lib/legal-info";

interface NetworkMessageOptions {
  to: string;
  /** Display name of the message sender. */
  fromName: string;
  /** Short preview of the message body (already truncated by the caller). */
  preview: string;
  /** Absolute URL of the conversation thread. */
  threadUrl: string;
}

export function buildNetworkMessageEmail(
  opts: NetworkMessageOptions
): EmailMessage {
  const who = opts.fromName.trim() || "Пользователь";
  const subject = `Новое сообщение от ${who} — ${BRAND.name}`;

  const html = renderEmailHtml({
    preview: `${who}: ${opts.preview}`,
    body: `
      <p style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; line-height: 1.3;">
        Новое сообщение
      </p>
      <p style="margin: 0 0 12px 0;">
        <strong>${escape(who)}</strong> написал вам в сети ${BRAND.name}:
      </p>
      <p style="margin: 0 0 16px 0; padding: 12px 16px; background: #f8fafc; border-radius: 10px; color: #475569; font-style: italic;">
        ${escape(opts.preview)}
      </p>
    `,
    cta: { label: "Открыть переписку", url: opts.threadUrl },
  });

  const text = renderEmailText(
    [
      "Новое сообщение",
      `${who} написал вам в сети ${BRAND.name}:`,
      `«${opts.preview}»`,
    ],
    { label: "Открыть переписку", url: opts.threadUrl }
  );

  return { to: opts.to, subject, html, text, tag: "network-message" };
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
