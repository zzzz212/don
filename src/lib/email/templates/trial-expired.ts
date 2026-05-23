// "Your trial expired" — second of the two-email trial-conversion
// sequence. Triggered by the same daily cron when trialEndsAt has
// passed in the last 24 hours and the user still hasn't subscribed.
//
// Tone is matter-of-fact, not guilt-trippy. The reader has now
// experienced the product enough to decide; we either earned the
// conversion or we didn't. The "you can come back" framing leaves
// the door open for later signup without nagging.

import type { EmailMessage } from "../provider";
import { renderEmailHtml, renderEmailText } from "./layout";
import { BRAND } from "@/lib/legal-info";

interface Options {
  to: string;
  name: string | null;
}

export function buildTrialExpiredEmail(opts: Options): EmailMessage {
  const subject = `Триал завершён — ${BRAND.name}`;
  const billingUrl = `${BRAND.publicUrl}/billing`;
  const greeting = opts.name ? `${opts.name},` : "Привет.";

  const html = renderEmailHtml({
    preview: `Пробный период «Про» закончился. Аккаунт переключён на «Старт» — основные функции остаются.`,
    body: `
      <p style="margin: 0 0 12px 0; font-size: 22px; font-weight: 700; line-height: 1.3;">
        Триал завершён
      </p>
      <p style="margin: 0 0 16px 0;">
        ${greeting} ваш пробный период тарифа «Про» закончился. Аккаунт
        автоматически переключён на бесплатный «Старт» — основные
        функции по-прежнему доступны: 10 анализов и 5 генераций в
        месяц, чат-юрист без ограничений.
      </p>
      <p style="margin: 0 0 16px 0;">
        Все договоры и шаблоны, которые вы создали за время триала,
        остаются в вашем рабочем пространстве. Никакие данные не
        удаляются — это просто переключение тарифа.
      </p>
      <p style="margin: 0 0 16px 0; color: #64748b; font-size: 14px; padding-top: 8px; border-top: 1px solid #e2e8f0;">
        Если работа с сервисом оказалась полезной — оформите подписку
        «Pro Solo» за 1 990 ₽/мес. Безлимит на генерацию и чат, до 100
        анализов в месяц, OCR. Можно отменить в любой момент.
      </p>
    `,
    cta: { label: "Посмотреть тарифы", url: billingUrl },
  });

  const text = renderEmailText(
    [
      `Триал завершён.`,
      `${greeting} ваш пробный период «Про» закончился. Аккаунт переключён на бесплатный «Старт» — 10 анализов и 5 генераций в месяц по-прежнему доступны.`,
      `Все данные сохранены. Если хотите безлимит — оформите подписку «Pro Solo» за 1 990 ₽/мес.`,
    ],
    { label: "Посмотреть тарифы", url: billingUrl }
  );

  return {
    to: opts.to,
    subject,
    html,
    text,
    tag: "trial-expired",
  };
}
