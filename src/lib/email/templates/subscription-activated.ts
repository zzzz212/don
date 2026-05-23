// "Thank you for paying" + period summary. ЮKassa already sends a 54-ФЗ
// receipt independently — this email exists for branded re-confirmation
// and to deep-link the customer back to /billing where they can see the
// new period boundary and toggle auto-renewal.

import type { EmailMessage } from "../provider";
import { renderEmailHtml, renderEmailText } from "./layout";
import { BRAND, type PaidPlan } from "@/lib/legal-info";

interface Options {
  to: string;
  plan: PaidPlan;
  amountRub: number;
  /** ISO string — formatted as a Russian date in the email body. */
  periodEnd: string;
}

// Human-readable label for the email subject + body. Mirrors PLAN_LABEL
// in legal-info but lives here so the email template doesn't pick up
// future UI-only relabelling (e.g. localising "Pro Solo" → "Pro Соло"
// in the marketing UI shouldn't change the legal receipt text).
const PLAN_LABEL: Record<PaidPlan, string> = {
  PRO_SOLO: "Pro Solo",
  PRO_TEAM: "Pro Team",
  BUSINESS: "Бизнес",
  // Legacy: any historical Subscription.plan = 'PRO' replays through
  // here when we re-send a receipt; show the same label as PRO_SOLO.
  PRO: "Pro Solo",
};

function formatRub(amount: number): string {
  return new Intl.NumberFormat("ru-RU").format(amount);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function buildSubscriptionActivatedEmail(opts: Options): EmailMessage {
  const planLabel = PLAN_LABEL[opts.plan];
  const subject = `Подписка «${planLabel}» активирована — ${BRAND.name}`;
  const periodEndHuman = formatDate(opts.periodEnd);
  const billingUrl = `${BRAND.publicUrl}/billing`;

  const html = renderEmailHtml({
    preview: `Подписка «${planLabel}» активирована до ${periodEndHuman}.`,
    body: `
      <p style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; line-height: 1.3;">
        Спасибо за оплату!
      </p>
      <p style="margin: 0 0 16px 0;">
        Тариф <strong>«${planLabel}»</strong> активирован для вашего рабочего пространства.
        Все функции тарифа доступны до <strong>${periodEndHuman}</strong>.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 16px 0; background:#f8fafc; border-radius:10px;">
        <tr>
          <td style="padding: 14px 18px;">
            <p style="margin: 0; font-size: 13px; color: #64748b;">Тариф</p>
            <p style="margin: 2px 0 0 0; font-size: 16px; font-weight: 600;">${planLabel}</p>
          </td>
          <td style="padding: 14px 18px; border-left: 1px solid #e2e8f0;">
            <p style="margin: 0; font-size: 13px; color: #64748b;">Сумма</p>
            <p style="margin: 2px 0 0 0; font-size: 16px; font-weight: 600;">${formatRub(opts.amountRub)} ₽</p>
          </td>
          <td style="padding: 14px 18px; border-left: 1px solid #e2e8f0;">
            <p style="margin: 0; font-size: 13px; color: #64748b;">Действует до</p>
            <p style="margin: 2px 0 0 0; font-size: 16px; font-weight: 600;">${periodEndHuman}</p>
          </td>
        </tr>
      </table>
      <p style="margin: 0 0 16px 0; color: #64748b; font-size: 13px;">
        Кассовый чек по 54-ФЗ направлен отдельным письмом от ЮKassa. Если
        чек не пришёл в течение 5 минут — напишите в поддержку.
      </p>
    `,
    cta: { label: "Открыть биллинг", url: billingUrl },
  });

  const text = renderEmailText(
    [
      "Спасибо за оплату!",
      `Тариф «${planLabel}» активирован для вашего рабочего пространства. Действует до ${periodEndHuman}.`,
      `Сумма: ${formatRub(opts.amountRub)} ₽.`,
      `Кассовый чек по 54-ФЗ направлен отдельным письмом от ЮKassa.`,
    ],
    { label: "Открыть биллинг", url: billingUrl }
  );

  return {
    to: opts.to,
    subject,
    html,
    text,
    tag: "subscription-activated",
  };
}
