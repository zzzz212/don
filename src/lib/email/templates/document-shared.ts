// Sent to a user when a connection forwards them a contract for review.
// The reviewer needs to know a document is waiting without polling
// /network themselves.

import type { EmailMessage } from "../provider";
import { renderEmailHtml, renderEmailText } from "./layout";
import { BRAND } from "@/lib/legal-info";

interface DocumentSharedOptions {
  to: string;
  /** Display name of the user who sent the document. */
  fromName: string;
  /** File name of the shared contract. */
  documentName: string;
  /** Absolute URL of the review page for this share. */
  shareUrl: string;
}

export function buildDocumentSharedEmail(
  opts: DocumentSharedOptions
): EmailMessage {
  const who = opts.fromName.trim() || "Пользователь";
  const subject = `${who} прислал договор на ревью — ${BRAND.name}`;

  const html = renderEmailHtml({
    preview: `${who} отправил вам договор «${opts.documentName}» на ревью.`,
    body: `
      <p style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; line-height: 1.3;">
        Договор на ревью
      </p>
      <p style="margin: 0 0 16px 0;">
        <strong>${escape(who)}</strong> отправил вам договор
        <strong>«${escape(opts.documentName)}»</strong> на сервисе ${BRAND.name}.
        Откройте ревью, чтобы посмотреть текст и его автоматический анализ,
        оставить комментарии или сохранить копию себе.
      </p>
    `,
    cta: { label: "Открыть ревью", url: opts.shareUrl },
  });

  const text = renderEmailText(
    [
      "Договор на ревью",
      `${who} отправил вам договор "${opts.documentName}" на ревью на сервисе ${BRAND.name}.`,
    ],
    { label: "Открыть ревью", url: opts.shareUrl }
  );

  return { to: opts.to, subject, html, text, tag: "network-share" };
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
