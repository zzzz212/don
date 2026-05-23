// Sent when a user started checkout (Payment row in PENDING /
// WAITING_FOR_CAPTURE) but didn't complete within 6-72 hours. Most
// abandoned checkouts are because the user got distracted, not
// because they changed their mind — gentle reminder converts a
// meaningful fraction of these.

import type { EmailMessage } from "../provider";
import { renderEmailHtml, renderEmailText } from "./layout";
import { BRAND, planLabel } from "@/lib/legal-info";

interface Options {
  to: string;
  name: string | null;
  /** The plan the user was trying to subscribe to. */
  plan: string;
  /** Optional confirmation URL from ЮKassa — when populated lets the
   *  recipient resume exactly where they left off. We pass null when
   *  the original URL has expired (ЮKassa confirmation URLs live
   *  ~5 minutes for most flows). */
  confirmationUrl: string | null;
}

export function buildCheckoutAbandonedEmail(opts: Options): EmailMessage {
  const subject = `Не получилось оформить подписку? — ${BRAND.name}`;
  const billingUrl = `${BRAND.publicUrl}/billing`;
  const greeting = opts.name ? `${opts.name},` : "Привет.";
  const planName = planLabel(opts.plan);
  // Use the live confirmation URL if it's still valid; otherwise send
  // to /billing where the user can re-trigger checkout from the same
  // plan card.
  const resumeUrl = opts.confirmationUrl ?? billingUrl;

  const html = renderEmailHtml({
    preview: `Вы начали оформлять «${planName}», но не завершили. Возобновить можно в один клик.`,
    body: `
      <p style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; line-height: 1.3;">
        Не получилось завершить оформление?
      </p>
      <p style="margin: 0 0 16px 0;">
        ${greeting} вы начали оформлять подписку «<strong>${planName}</strong>» в
        ${BRAND.name}, но не завершили платёж. Чаще всего это означает,
        что что-то отвлекло — не обязательно что вы передумали.
      </p>
      <p style="margin: 0 0 16px 0;">
        Возобновить оформление можно по той же ссылке (если она ещё
        активна) или перезапустить с биллинг-страницы — карточка
        запомнит выбранный тариф.
      </p>
      <p style="margin: 0 0 16px 0; color: #64748b; font-size: 14px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
        Если что-то непонятно в условиях тарифа — все ответы в{" "}
        <a href="${BRAND.publicUrl}/help" style="color:#1d4ed8;">разделе помощи</a> или
        напишите в поддержку, мы быстро ответим.
      </p>
    `,
    cta: { label: "Продолжить оформление", url: resumeUrl },
    ctaFallbackNote: `Ссылка не открывается? Перейдите на страницу биллинга: <a href="${billingUrl}" style="color:#1d4ed8;">${billingUrl}</a>`,
  });

  const text = renderEmailText(
    [
      `Не получилось завершить оформление?`,
      `${greeting} вы начали оформлять подписку «${planName}» в ${BRAND.name}, но не завершили платёж.`,
      `Возобновить можно по той же ссылке или перезапустить с биллинг-страницы — карточка запомнит выбранный тариф.`,
      `Вопросы — в разделе помощи: ${BRAND.publicUrl}/help`,
    ],
    { label: "Продолжить оформление", url: resumeUrl }
  );

  return {
    to: opts.to,
    subject,
    html,
    text,
    tag: "checkout-abandoned",
  };
}
