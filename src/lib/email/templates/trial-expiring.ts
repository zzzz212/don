// "Your trial expires in 1 day" reminder. Triggered by the daily cron
// at /api/cron/billing-reminders for any user whose trialEndsAt falls
// within the next 24 hours and who hasn't yet activated a paid
// subscription.
//
// Two-day trial means we get exactly one shot at this email. Subject
// line is intentionally direct ("Триал заканчивается завтра") — opt-in
// rates on coy/funny subjects are systematically lower for billing
// reminders. Body is short on copy, heavy on the action.

import type { EmailMessage } from "../provider";
import { renderEmailHtml, renderEmailText } from "./layout";
import { BRAND } from "@/lib/legal-info";

interface Options {
  to: string;
  /** User's display name, if known. Otherwise empty / null. */
  name: string | null;
  /** ISO date the trial expires — used in body copy. */
  trialEndsAt: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}

export function buildTrialExpiringEmail(opts: Options): EmailMessage {
  const subject = `Триал «Про» заканчивается завтра — ${BRAND.name}`;
  const billingUrl = `${BRAND.publicUrl}/billing`;
  const greeting = opts.name ? `${opts.name}, привет.` : "Привет.";
  const endDate = formatDate(opts.trialEndsAt);

  const html = renderEmailHtml({
    preview: `Триал «Про» заканчивается ${endDate}. Подключите подписку, чтобы сохранить безлимит.`,
    body: `
      <p style="margin: 0 0 12px 0; font-size: 22px; font-weight: 700; line-height: 1.3;">
        Триал заканчивается ${endDate}
      </p>
      <p style="margin: 0 0 16px 0;">
        ${greeting} Завтра ваш пробный период тарифа «Про»
        автоматически завершится — рабочее пространство переключится на
        бесплатный «Старт» с лимитом 10 анализов и 5 генераций в месяц.
      </p>
      <p style="margin: 0 0 16px 0;">
        Если вам нужен безлимит на генерацию и 100+ анализов в месяц —
        оформите подписку «Pro Solo» за 1 990 ₽/мес. Тариф привязан к
        аккаунту, действует во всех ваших рабочих пространствах, можно
        отменить в один клик.
      </p>
      <p style="margin: 0 0 16px 0; color: #64748b; font-size: 14px;">
        Что вы получите на «Pro Solo»:
      </p>
      <ul style="margin: 0 0 16px 0; padding-left: 20px; color: #0f172a;">
        <li style="margin: 4px 0;">До 100 анализов договоров в месяц на модели Sonnet</li>
        <li style="margin: 4px 0;">Безлимитная генерация документов и чат</li>
        <li style="margin: 4px 0;">OCR для сканов PDF</li>
        <li style="margin: 4px 0;">Векторный поиск по всем загруженным договорам</li>
      </ul>
    `,
    cta: { label: "Оформить подписку", url: billingUrl },
    ctaFallbackNote: `Ссылка не открывается? Скопируйте в браузер: ${billingUrl}`,
  });

  const text = renderEmailText(
    [
      `Триал заканчивается ${endDate}.`,
      `${greeting} Завтра ваш пробный период «Про» автоматически завершится — рабочее пространство переключится на бесплатный «Старт».`,
      `Чтобы сохранить безлимитную генерацию, OCR и расширенные лимиты на анализ — оформите подписку «Pro Solo» за 1 990 ₽/мес.`,
    ],
    { label: "Оформить подписку", url: billingUrl }
  );

  return {
    to: opts.to,
    subject,
    html,
    text,
    tag: "trial-expiring",
  };
}
