// Sent right after a successful sign-up. Goal: confirm the inbox the user
// supplied is real (deliverability check) and orient them to the first
// action — either uploading their own contract or reading the sample
// report to see what they'll get back.

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
  const analyzeUrl = `${BRAND.publicUrl}/analyze`;
  const sampleUrl = `${BRAND.publicUrl}/sample-report`;
  const billingUrl = `${BRAND.publicUrl}/billing`;
  const blogUrl = `${BRAND.publicUrl}/blog`;
  const trialPhrase = `${TRIAL_DAYS} ${dayWord(TRIAL_DAYS)}`;

  const html = renderEmailHtml({
    preview: `Добро пожаловать в ${BRAND.name}. Тариф «Старт» — 10 анализов в месяц без карты.`,
    body: `
      <p style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; line-height: 1.3;">
        Здравствуйте, ${escape(name)}!
      </p>
      <p style="margin: 0 0 16px 0;">
        Спасибо за регистрацию в <strong>${BRAND.name}</strong>. Аккаунт готов
        к работе на тарифе «Старт» — 10 анализов договоров и 5 генераций
        документов в месяц, бесплатно и без привязки карты.
      </p>
      <p style="margin: 0 0 16px 0; font-weight: 600;">
        Как начать за 2 минуты:
      </p>
      <ol style="margin: 0 0 16px 0; padding-left: 22px; color: #0f172a;">
        <li style="margin: 6px 0;">
          <strong>Загрузите договор</strong> в PDF или DOCX (любой:
          оказание услуг, аренда, NDA, поставка). Через 30–60 секунд
          получите отчёт со ссылками на ГК РФ и готовыми формулировками
          правок.
        </li>
        <li style="margin: 6px 0;">
          <strong>Не готовы загружать свой?</strong> Посмотрите
          <a href="${sampleUrl}" style="color:#1d4ed8; font-weight: 600; text-decoration: underline;">пример отчёта</a> —
          это анализ типового IT-договора с 5 найденными рисками. Тот
          же формат, что вернёт сервис на вашем файле.
        </li>
        <li style="margin: 6px 0;">
          <strong>Нужен новый договор?</strong> На странице «Шаблоны»
          20 готовых под российское право — NDA, аренда, услуги,
          поставка, ГПХ, трудовой. Заполняете форму — получаете
          документ.
        </li>
      </ol>
      <p style="margin: 24px 0 12px 0; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">
        Понравится — на «Pro Solo» (1 990 ₽/мес) безлимит на
        генерацию и до 100 анализов в месяц. Можно сначала попробовать
        бесплатный триал на ${trialPhrase} —
        <a href="${billingUrl}" style="color:#1d4ed8;">активировать в один клик</a>,
        без карты и автосписаний.
      </p>
      <p style="margin: 0; color: #64748b; font-size: 14px;">
        Полезно почитать перед первой загрузкой:
        <a href="${blogUrl}" style="color:#1d4ed8;">журнал ЮрИИст</a> —
        разборы типовых договоров со ссылками на статьи ГК.
      </p>
    `,
    cta: { label: "Загрузить первый договор", url: analyzeUrl },
    ctaFallbackNote: `Не открывается? Перейдите по адресу: <a href="${analyzeUrl}" style="color:#1d4ed8;">${analyzeUrl}</a>`,
  });

  const text = renderEmailText(
    [
      `Здравствуйте, ${name}!`,
      `Спасибо за регистрацию в ${BRAND.name}. Аккаунт готов к работе на тарифе «Старт» — 10 анализов и 5 генераций в месяц, бесплатно.`,
      `Как начать за 2 минуты:`,
      `1. Загрузите договор (PDF/DOCX) — через 30-60 секунд получите отчёт со ссылками на ГК РФ.`,
      `2. Не готовы загружать свой? Посмотрите пример отчёта: ${sampleUrl}`,
      `3. Нужен новый договор? Шаблоны: ${BRAND.publicUrl}/templates`,
      `На «Pro Solo» (1 990 ₽/мес) — безлимит. Доступен бесплатный триал на ${trialPhrase} (без карты): ${billingUrl}`,
      `Журнал ЮрИИст: ${blogUrl}`,
    ],
    { label: "Загрузить первый договор", url: analyzeUrl }
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
