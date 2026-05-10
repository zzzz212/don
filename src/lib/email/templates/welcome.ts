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

export function buildWelcomeEmail(opts: WelcomeOptions): EmailMessage {
  const name = (opts.name && opts.name.trim()) || opts.to.split("@")[0] || "коллега";
  const dashboardUrl = `${BRAND.publicUrl}/dashboard`;

  const html = renderEmailHtml({
    preview: `Добро пожаловать в ${BRAND.name}. Ваш пробный период активирован.`,
    body: `
      <p style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; line-height: 1.3;">
        Здравствуйте, ${escape(name)}!
      </p>
      <p style="margin: 0 0 16px 0;">
        Спасибо, что зарегистрировались в <strong>${BRAND.name}</strong>. Аккаунт готов
        к работе. Чтобы вы могли спокойно протестировать платный функционал — мы
        активировали пробный доступ к тарифу <strong>«Про»</strong> на ${TRIAL_DAYS} дней:
        безлимитный анализ договоров, генерация документов, OCR для скан-PDF.
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
      `Спасибо, что зарегистрировались в ${BRAND.name}. Аккаунт готов к работе.`,
      `Мы активировали пробный доступ к тарифу «Про» на ${TRIAL_DAYS} дней: безлимитный анализ договоров, генерация документов, OCR для скан-PDF.`,
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
