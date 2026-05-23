// Sent by the daily cron a few days before a contract deadline the user
// asked us to track (end of term, auto-renewal cut-off, payment date).

import type { EmailMessage } from "../provider";
import { renderEmailHtml, renderEmailText } from "./layout";

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function daysWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "дня";
  return "дней";
}

interface ContractReminderOptions {
  to: string;
  /** Human label of the deadline, e.g. "Окончание срока действия договора". */
  deadlineLabel: string;
  /** File name of the contract. */
  documentName: string;
  /** Localised due date, e.g. "31 декабря 2026". */
  dueDateLabel: string;
  /** Whole days remaining until the deadline. */
  daysLeft: number;
  /** Absolute URL of the /deadlines page. */
  deadlinesUrl: string;
}

export function buildContractReminderEmail(
  opts: ContractReminderOptions
): EmailMessage {
  const when =
    opts.daysLeft <= 0
      ? "сегодня"
      : `через ${opts.daysLeft} ${daysWord(opts.daysLeft)}`;
  const subject = `Напоминание: ${opts.deadlineLabel} — ${when}`;

  const html = renderEmailHtml({
    preview: `${opts.deadlineLabel} по договору «${opts.documentName}» — ${opts.dueDateLabel}.`,
    body: `
      <p style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; line-height: 1.3;">
        Приближается срок по договору
      </p>
      <p style="margin: 0 0 12px 0;">
        По договору <strong>«${escape(opts.documentName)}»</strong>
        приближается важная дата:
      </p>
      <p style="margin: 0 0 16px 0; padding: 12px 16px; background: #f8fafc; border-radius: 10px;">
        <strong>${escape(opts.deadlineLabel)}</strong><br>
        ${escape(opts.dueDateLabel)} — ${when}
      </p>
      <p style="margin: 0 0 16px 0;">
        Откройте раздел «Сроки и напоминания», чтобы свериться со всеми
        датами по вашим договорам.
      </p>
    `,
    cta: { label: "Открыть напоминания", url: opts.deadlinesUrl },
  });

  const text = renderEmailText(
    [
      "Приближается срок по договору",
      `Договор: ${opts.documentName}`,
      `${opts.deadlineLabel} — ${opts.dueDateLabel} (${when}).`,
    ],
    { label: "Открыть напоминания", url: opts.deadlinesUrl }
  );

  return { to: opts.to, subject, html, text, tag: "contract-reminder" };
}
