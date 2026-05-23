// Sent to a referrer when someone they invited activates their trial —
// both sides have just earned bonus analyses.

import type { EmailMessage } from "../provider";
import { renderEmailHtml, renderEmailText } from "./layout";
import { BRAND } from "@/lib/legal-info";

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function analysesWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "анализ";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
    return "анализа";
  return "анализов";
}

interface ReferralRewardOptions {
  to: string;
  /** Name of the friend who joined, if known. */
  friendName: string | null;
  /** Bonus analyses credited to each side. */
  bonus: number;
  /** Absolute URL of the /referral page. */
  referralUrl: string;
}

export function buildReferralRewardEmail(
  opts: ReferralRewardOptions
): EmailMessage {
  const friend = (opts.friendName && opts.friendName.trim()) || "Ваш коллега";
  const subject = `Вам начислено ${opts.bonus} ${analysesWord(opts.bonus)} — спасибо за приглашение`;

  const html = renderEmailHtml({
    preview: `${friend} присоединился по вашей ссылке — вам начислены бонусные анализы.`,
    body: `
      <p style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; line-height: 1.3;">
        Спасибо за приглашение!
      </p>
      <p style="margin: 0 0 16px 0;">
        <strong>${escape(friend)}</strong> присоединился к ${BRAND.name} по
        вашей ссылке и активировал пробный период. Вам обоим начислено
        по <strong>${opts.bonus} ${analysesWord(opts.bonus)}</strong>
        договоров — они добавятся к бесплатному месячному лимиту.
      </p>
      <p style="margin: 0 0 16px 0;">
        Приглашайте ещё коллег — за каждого вы получаете новые бонусные
        анализы.
      </p>
    `,
    cta: { label: "Моя реферальная ссылка", url: opts.referralUrl },
  });

  const text = renderEmailText(
    [
      "Спасибо за приглашение!",
      `${friend} присоединился по вашей ссылке. Вам обоим начислено по ${opts.bonus} ${analysesWord(opts.bonus)} договоров.`,
    ],
    { label: "Моя реферальная ссылка", url: opts.referralUrl }
  );

  return { to: opts.to, subject, html, text, tag: "referral-reward" };
}
