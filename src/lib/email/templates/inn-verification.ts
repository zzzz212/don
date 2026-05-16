// Sent when an admin resolves an ИНН verification request — either the
// uploaded ЕГРЮЛ/ЕГРИП extract confirmed the claim ("verified") or it
// didn't ("rejected"). The user submitted a document and now waits for
// an answer they wouldn't otherwise see without polling their profile.

import type { EmailMessage } from "../provider";
import { renderEmailHtml, renderEmailText } from "./layout";
import { BRAND } from "@/lib/legal-info";

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface VerifiedOptions {
  to: string;
  /** Official company / ИП name the ИНН resolved to. */
  companyName: string;
  profileUrl: string;
}

export function buildInnVerifiedEmail(opts: VerifiedOptions): EmailMessage {
  const subject = `ИНН подтверждён — ${BRAND.name}`;
  const html = renderEmailHtml({
    preview: `ИНН организации «${opts.companyName}» подтверждён.`,
    body: `
      <p style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; line-height: 1.3;">
        ИНН подтверждён
      </p>
      <p style="margin: 0 0 16px 0;">
        Мы проверили загруженную выписку и подтвердили, что вы представляете
        <strong>${escape(opts.companyName)}</strong>. В вашем профиле теперь
        отображается отметка «ИНН подтверждён» — она повышает доверие
        контрагентов и позволяет им написать вам напрямую из поиска.
      </p>
    `,
    cta: { label: "Открыть профиль", url: opts.profileUrl },
  });
  const text = renderEmailText(
    [
      "ИНН подтверждён",
      `Мы подтвердили, что вы представляете ${opts.companyName}. В профиле появилась отметка «ИНН подтверждён».`,
    ],
    { label: "Открыть профиль", url: opts.profileUrl }
  );
  return { to: opts.to, subject, html, text, tag: "inn-verified" };
}

interface RejectedOptions {
  to: string;
  /** Reason supplied by the admin — shown verbatim. */
  reason: string;
  profileUrl: string;
}

export function buildInnRejectedEmail(opts: RejectedOptions): EmailMessage {
  const subject = `Подтверждение ИНН не прошло — ${BRAND.name}`;
  const reason = opts.reason.trim() || "Документ не подтверждает связь с организацией.";
  const html = renderEmailHtml({
    preview: "Загруженная выписка не подтвердила привязку ИНН.",
    body: `
      <p style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; line-height: 1.3;">
        Не удалось подтвердить ИНН
      </p>
      <p style="margin: 0 0 12px 0;">
        Мы рассмотрели загруженный документ, но не смогли подтвердить
        привязку ИНН. Причина:
      </p>
      <p style="margin: 0 0 16px 0; padding: 12px 16px; background: #f8fafc; border-radius: 10px; color: #475569;">
        ${escape(reason)}
      </p>
      <p style="margin: 0 0 16px 0;">
        ИНН остаётся привязанным со статусом «указан». Вы можете загрузить
        другую выписку ЕГРЮЛ/ЕГРИП в профиле и отправить заявку повторно.
      </p>
    `,
    cta: { label: "Загрузить документ заново", url: opts.profileUrl },
  });
  const text = renderEmailText(
    [
      "Не удалось подтвердить ИНН",
      `Причина: ${reason}`,
      "ИНН остаётся со статусом «указан». Загрузите другую выписку и отправьте заявку повторно.",
    ],
    { label: "Открыть профиль", url: opts.profileUrl }
  );
  return { to: opts.to, subject, html, text, tag: "inn-rejected" };
}
