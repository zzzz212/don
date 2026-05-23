// Sent to a counterparty when a sender creates a Deal Room from an
// analysed contract. The receiver opens /deal/[token] to view the
// AI-prepared position and negotiate clauses without needing to
// register. Cookie-bound session identity (Task 5) tracks who has
// agreed/disagreed/commented on each clause.

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
  const subject = `${who} отправил вам договор для согласования — ${BRAND.name}`;

  // Personal message rendered as a warm-minimalism callout — cream
  // background, terracotta left border. Escaped because it's
  // user-controlled (sender free-types it).
  const messageBlock = opts.message
    ? `
      <div style="margin: 0 0 20px 0; padding: 14px 16px; background: #FAF3E6; border-left: 3px solid #C2613F; border-radius: 4px; font-style: italic;">
        «${escapeHtml(opts.message)}»
      </div>
    `
    : "";

  // fromName comes from session.user.name (user-controlled) and
  // documentName comes from doc.fileName (user-controlled at upload).
  // renderEmailHtml raw-inserts opts.body — every interpolated user
  // value goes through escapeHtml first.
  const html = renderEmailHtml({
    preview: `${who} прислал вам договор «${opts.documentName}» для согласования.`,
    body: `
      <p style="margin: 0 0 16px 0; font-size: 22px; font-weight: 600; line-height: 1.3;">
        Договор для согласования
      </p>
      <p style="margin: 0 0 16px 0;">
        <strong>${safeWho}</strong> хочет согласовать с вами договор
        <strong>«${safeDoc}»</strong>.
      </p>
      ${messageBlock}
      <p style="margin: 0 0 8px 0;">
        Откройте ссылку — Яксо покажет вам разбор договора с вашей стороны
        и где можно поторговаться. Логин не требуется.
      </p>
      <ul style="margin: 0 0 16px 0; padding-left: 20px; color: #5C5446;">
        <li>AI разберёт договор за вас и подсветит риски</li>
        <li>Можно отметить пункты «согласен / не согласен»</li>
        <li>Можно предложить правки в одном клике</li>
      </ul>
    `,
    cta: { label: "Открыть договор", url: opts.dealUrl },
  });

  const text = renderEmailText(
    [
      "Договор для согласования",
      `${who} хочет согласовать с вами договор "${opts.documentName}" на сервисе ${BRAND.name}.`,
      ...(opts.message ? [`Сообщение: «${opts.message}»`] : []),
      "Откройте ссылку — Яксо покажет вам разбор. Логин не требуется.",
    ],
    { label: "Открыть договор", url: opts.dealUrl }
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
