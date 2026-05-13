// "We haven't seen you in a while" re-engagement. Triggered by the
// daily cron when a user hasn't used any AI feature (no AiUsage rows)
// in the past 14 days. Single send per user with a long dedup window
// (90 days) — we want to nudge dormant users without becoming the
// company that pesters everyone forever.
//
// Tone is genuinely useful, not promotional: lead with concrete value
// (link to the most popular article), then a soft reminder of free
// tier limits.

import type { EmailMessage } from "../provider";
import { renderEmailHtml, renderEmailText } from "./layout";
import { BRAND } from "@/lib/legal-info";

interface Options {
  to: string;
  name: string | null;
}

export function buildInactiveReengagementEmail(opts: Options): EmailMessage {
  const subject = `Что нового в ${BRAND.name}`;
  const analyzeUrl = `${BRAND.publicUrl}/analyze`;
  const blogUrl = `${BRAND.publicUrl}/blog`;
  const sampleUrl = `${BRAND.publicUrl}/sample-report`;
  const greeting = opts.name ? `${opts.name},` : "Привет.";

  const html = renderEmailHtml({
    preview: `Несколько свежих разборов договоров в журнале + у вас всё ещё доступно 10 анализов в месяц.`,
    body: `
      <p style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; line-height: 1.3;">
        Не хотим теряться
      </p>
      <p style="margin: 0 0 16px 0;">
        ${greeting} давно вас не видели в ${BRAND.name}. За пару недель в
        журнале появились разборы, на которые часто приходят запросы — и
        каждый со ссылками на конкретные статьи ГК РФ:
      </p>
      <ul style="margin: 0 0 16px 0; padding-left: 20px; color: #0f172a;">
        <li style="margin: 6px 0;">
          <a href="${BRAND.publicUrl}/blog/dogovor-s-marketplaceom-wb-ozon" style="color:#1d4ed8;">Договор с маркетплейсом (WB, OZON, Я.Маркет)</a> —
          разбор оферт, штрафов и блокировок;
        </li>
        <li style="margin: 6px 0;">
          <a href="${BRAND.publicUrl}/blog/gph-vs-ip-kogo-vybrat" style="color:#1d4ed8;">ГПХ или ИП в 2026</a> —
          сравнение налогов и рисков переквалификации;
        </li>
        <li style="margin: 6px 0;">
          <a href="${BRAND.publicUrl}/blog/dogovor-okazaniya-uslug-razbor" style="color:#1d4ed8;">Договор оказания услуг</a> —
          9 ключевых пунктов, на которые смотрит юрист.
        </li>
      </ul>
      <p style="margin: 0 0 16px 0; padding-top: 12px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">
        На вашем тарифе «Старт» по-прежнему доступно <strong>10 анализов
        и 5 генераций договоров в месяц</strong>. Если что-то нужно
        проверить — загрузите PDF или DOCX, отчёт придёт за 30-60 секунд.
        Если давно не помните, как выглядит результат — посмотрите{" "}
        <a href="${sampleUrl}" style="color:#1d4ed8;">пример отчёта</a>.
      </p>
    `,
    cta: { label: "Загрузить договор", url: analyzeUrl },
    ctaFallbackNote: `Хотите дочитать ещё статьи в журнале? <a href="${blogUrl}" style="color:#1d4ed8;">${blogUrl}</a>`,
  });

  const text = renderEmailText(
    [
      `Не хотим теряться.`,
      `${greeting} давно вас не видели. В журнале ${BRAND.name} появились свежие разборы:`,
      `• Договор с маркетплейсом: ${BRAND.publicUrl}/blog/dogovor-s-marketplaceom-wb-ozon`,
      `• ГПХ или ИП в 2026: ${BRAND.publicUrl}/blog/gph-vs-ip-kogo-vybrat`,
      `• Договор оказания услуг: ${BRAND.publicUrl}/blog/dogovor-okazaniya-uslug-razbor`,
      `На «Старте» по-прежнему доступно 10 анализов и 5 генераций в месяц. Пример отчёта: ${sampleUrl}`,
    ],
    { label: "Загрузить договор", url: analyzeUrl }
  );

  return {
    to: opts.to,
    subject,
    html,
    text,
    tag: "inactive-reengagement",
  };
}
