// Stub — Task 9 will replace this body with the full deal-invite template.
// The function signature is final; only the body HTML/text is placeholder.
//
// Sent to a counterparty when a sender creates a Deal Room from an
// analysed contract. The receiver opens /deal/[token] to view and
// negotiate clauses without needing to register.

import type { EmailMessage } from "../provider";
import { renderEmailHtml, renderEmailText } from "./layout";
import { BRAND } from "@/lib/legal-info";

interface DealInviteOptions {
  to: string;
  /** Display name of the user who opened the deal (sender). */
  fromName: string;
  /** Title of the contract being negotiated. */
  documentName: string;
  /** Absolute URL of the deal room — /deal/[inviteToken]. */
  dealUrl: string;
  /** Optional personal message from the sender. */
  message?: string;
}

export function buildDealInviteEmail(opts: DealInviteOptions): EmailMessage {
  const who = opts.fromName.trim() || "Пользователь";
  const safeWho = escapeHtml(who);
  const safeDoc = escapeHtml(opts.documentName);
  const subject = `${who} приглашает вас обсудить договор — ${BRAND.name}`;

  // fromName comes from session.user.name (user-controlled) and
  // documentName comes from doc.fileName (user-controlled at upload).
  // renderEmailHtml raw-inserts opts.body — we MUST escape every
  // user-controlled value before interpolating into the HTML string.
  const html = renderEmailHtml({
    preview: `${who} открыл сделку по договору «${opts.documentName}».`,
    body: `
      <p style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; line-height: 1.3;">
        Приглашение в Deal Room
      </p>
      <p style="margin: 0 0 16px 0;">
        <strong>${safeWho}</strong> приглашает вас обсудить договор
        <strong>«${safeDoc}»</strong> на сервисе ${BRAND.name}.
      </p>
    `,
    cta: { label: "Открыть сделку", url: opts.dealUrl },
  });

  const text = renderEmailText(
    [
      "Приглашение в Deal Room",
      `${who} приглашает вас обсудить договор "${opts.documentName}" на сервисе ${BRAND.name}.`,
      ...(opts.message ? [`Сообщение от отправителя: ${opts.message}`] : []),
    ],
    { label: "Открыть сделку", url: opts.dealUrl }
  );

  return { to: opts.to, subject, html, text, tag: "deal-invite" };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
