// Sent to a user when someone in the network sends them a connection
// request. Without this the recipient would only discover the request
// by happening to open /network — the feature is dead without it.

import type { EmailMessage } from "../provider";
import { renderEmailHtml, renderEmailText } from "./layout";
import { BRAND } from "@/lib/legal-info";

interface ConnectionRequestOptions {
  to: string;
  /** Display name of the user who sent the request. */
  requesterName: string;
  /** Absolute URL of the network section (the connections tab). */
  networkUrl: string;
}

export function buildConnectionRequestEmail(
  opts: ConnectionRequestOptions
): EmailMessage {
  const who = opts.requesterName.trim() || "Пользователь";
  const subject = `${who} хочет добавить вас в сеть — ${BRAND.name}`;

  const html = renderEmailHtml({
    preview: `${who} отправил вам запрос на связь.`,
    body: `
      <p style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; line-height: 1.3;">
        Новый запрос на связь
      </p>
      <p style="margin: 0 0 16px 0;">
        <strong>${escape(who)}</strong> хочет добавить вас в профессиональную
        сеть на сервисе ${BRAND.name}. После подтверждения вы сможете
        отправлять друг другу договоры на ревью и переписываться.
      </p>
    `,
    cta: { label: "Посмотреть запрос", url: opts.networkUrl },
  });

  const text = renderEmailText(
    [
      "Новый запрос на связь",
      `${who} хочет добавить вас в сеть на сервисе ${BRAND.name}. Подтвердите или отклоните запрос во вкладке «Связи».`,
    ],
    { label: "Посмотреть запрос", url: opts.networkUrl }
  );

  return { to: opts.to, subject, html, text, tag: "network-connection" };
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
