// Extract key calendar dates from a contract — end of term, auto-renewal
// cut-offs, payment milestones, notice periods. Runs on the fast tier
// (Haiku): a focused extraction, cheap enough to run on demand.

import { z } from "zod";
import { generate } from "@/lib/ai/client";

export type DeadlineKind =
  | "expiry"
  | "renewal"
  | "payment"
  | "notice"
  | "other";

export interface ExtractedDeadline {
  kind: DeadlineKind;
  label: string;
  dueDate: Date;
}

const ItemSchema = z.object({
  kind: z.enum(["expiry", "renewal", "payment", "notice", "other"]),
  // Short Russian label, e.g. "Окончание срока действия договора".
  label: z.string(),
  // Absolute calendar date, ISO YYYY-MM-DD.
  date: z.string(),
});

const ResultSchema = z.object({
  deadlines: z.array(ItemSchema),
});

// Contracts rarely exceed this; the date-bearing clauses (срок, оплата)
// are also usually near the start/end, so a generous cap is safe.
const MAX_CHARS = 60_000;

const SYSTEM = `Ты — ассистент юриста. Из текста договора ты извлекаешь ключевые
календарные даты, за которыми клиенту нужно следить:
— "expiry": окончание срока действия договора;
— "renewal": дата автопролонгации или крайний срок отказа от неё;
— "payment": сроки оплаты, платежи по графику;
— "notice": крайние сроки уведомлений (расторжение, претензия и т.п.);
— "other": иные важные даты.

Правила:
— Возвращай ТОЛЬКО абсолютные даты в формате YYYY-MM-DD.
— Если дата задана относительно ("12 месяцев с даты подписания") и в
  договоре есть дата, от которой можно отсчитать — вычисли её. Если
  отсчитать не от чего — пропусти эту дату, не угадывай.
— Не выдумывай даты, которых нет в тексте.
— Не более 12 дат. Каждая — с коротким понятным русским описанием.
— Если значимых дат нет — верни пустой список.`;

/**
 * Pull key dates out of a contract's raw text. Never throws on a bad
 * model response — an unparseable date is just dropped.
 */
export async function extractDeadlines(
  rawText: string
): Promise<ExtractedDeadline[]> {
  const text = rawText.slice(0, MAX_CHARS);
  const { data } = await generate({
    schema: ResultSchema,
    system: SYSTEM,
    prompt: `Извлеки ключевые даты из договора:\n\n${text}`,
    model: "fast",
    temperature: 0,
    maxTokens: 1024,
  });

  const out: ExtractedDeadline[] = [];
  for (const item of data.deadlines) {
    const due = new Date(`${item.date}T00:00:00.000Z`);
    if (Number.isNaN(due.getTime())) continue;
    const label = item.label.trim();
    if (!label) continue;
    out.push({ kind: item.kind, label: label.slice(0, 200), dueDate: due });
  }
  return out;
}
