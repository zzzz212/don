// Sent right after a successful sign-up. Goal: confirm the inbox the user
// supplied is real (deliverability check) and orient them to the first
// action — uploading their first contract — within one click.

import type { EmailMessage } from "../provider";
import { renderEmailHtml, renderEmailText } from "./layout";
import { BRAND, TRIAL_DAYS } from "@/lib/legal-info";

interface WelcomeOptions {
  to: string;
  /** Display name; falls back to the local-part of the email when empty. */
  name?: string | null;
}

// Russian plural for "день" — 1 день / 2-4 дня / 5+ дней.
function dayWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дня";
  return "дней";
}

export function buildWelcomeEmail(opts: WelcomeOptions): EmailMessage {
  const name = (opts.name && opts.name.trim()) || opts.to.split("@")[0] || "коллега";
  const dashboardUrl = `${BRAND.publicUrl}/dashboard`;
  const trialPhrase = `${TRIAL_DAYS} ${dayWord(TRIAL_DAYS)}`;

  const html = renderEmailHtml({
    preview: `Добро пожаловать в ${BRAND.name}.`,
    body: `
      <p style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; line-height: 1.3;">
        Здравствуйте, ${escape(name)}!
      </p>
      <p style="margin: 0 0 16px 0;">
        Спасибо, что зарегистрировались в <strong>${BRAND.name}</strong>. Аккаунт готов
        к работе на тарифе «Старт»: 3 анализа договоров и 2 генерации документов
        в месяц.
      </p>
      <p style="margin: 0 0 16px 0;">
        Хотите попробовать тариф «Про» — безлимитный анализ, OCR для скан-PDF
        и генерацию документов? Активируйте бесплатный пробный период на
        ${trialPhrase} прямо в разделе «Тариф и биллинг» (одна кнопка,
        без привязки карты).
      </p>
      <p style="margin: 0 0 16px 0;">
        Самый быстрый способ оценить сервис — загрузить любой ваш договор и
        получить отчёт о рисках за 30 секунд.
      </p>
    `,
    cta: { label: "Загрузить первый договор", url: `${BRAND.publicUrl}/analyze` },
    ctaFallbackNote: `Не открывается кнопка? Перейдите по адресу: <a href="${dashboardUrl}" style="color:#1d4ed8;">${dashboardUrl}</a>`,
  });

  const text = renderEmailText(
    [
      `Здравствуйте, ${name}!`,
      `Спасибо, что зарегистрировались в ${BRAND.name}. Аккаунт готов к работе на тарифе «Старт»: 3 анализа договоров и 2 генерации документов в месяц.`,
      `Хотите попробовать тариф «Про» — безлимитный анализ, OCR и генерацию? Активируйте бесплатный пробный период на ${trialPhrase} в разделе «Тариф и биллинг» (одна кнопка, без привязки карты).`,
      `Самый быстрый способ оценить сервис — загрузить договор и получить отчёт о рисках за 30 секунд.`,
    ],
    { label: "Загрузить первый договор", url: `${BRAND.publicUrl}/analyze` }
  );

  return {
    to: opts.to,
    subject: `Добро пожаловать в ${BRAND.name}`,
    html,
    text,
    tag: "welcome",
  };
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
