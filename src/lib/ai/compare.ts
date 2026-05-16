// Compare two versions of a contract — typically the user's draft (A)
// against the counterparty's redline (B) — and explain, in plain terms,
// what changed and whether each change cuts for or against the user.

import { z } from "zod";
import { generate } from "@/lib/ai/client";

const ChangeSchema = z.object({
  // Section / clause the change touches, e.g. "Ответственность сторон".
  section: z.string(),
  // What concretely changed between version A and version B.
  change: z.string(),
  // From the perspective of the user (who uploaded version A).
  impact: z.enum(["risk", "neutral", "improvement"]),
  // Why it matters — the practical consequence.
  detail: z.string(),
});

const ResultSchema = z.object({
  summary: z.string(),
  changes: z.array(ChangeSchema),
});

export type ContractChange = z.infer<typeof ChangeSchema>;
export type CompareResult = z.infer<typeof ResultSchema>;

// Two contracts can be long; cap each side so a pathological upload
// can't blow the context window or the token budget.
const MAX_CHARS = 40_000;

const SYSTEM = `Ты — юрист, который сравнивает две версии одного договора.
Версия A — это вариант пользователя. Версия B — вариант контрагента
(например, присланная правка). Найди СОДЕРЖАТЕЛЬНЫЕ отличия — изменения
прав, обязанностей, сумм, сроков, ответственности, условий расторжения.
Игнорируй косметику: переформулировки без смысловой разницы, опечатки,
изменения нумерации.

Для каждого отличия оцени impact с точки зрения пользователя (версия A):
— "risk" — изменение ухудшает положение пользователя;
— "improvement" — улучшает;
— "neutral" — меняет суть, но баланс не сдвигает.

Дай краткое summary (2–4 предложения): в чью пользу в целом смещена
версия B и на что обратить внимание в первую очередь. Если содержательных
отличий нет — так и напиши, changes оставь пустым.

Это автоматическая оценка, а не юридическая консультация.`;

/**
 * Run the AI comparison. Throws on a hard provider failure — the caller
 * (route handler) maps that to a 500.
 */
export async function compareContracts(
  textA: string,
  textB: string
): Promise<CompareResult> {
  const { data } = await generate({
    schema: ResultSchema,
    system: SYSTEM,
    prompt: `=== ВЕРСИЯ A (пользователь) ===\n${textA.slice(0, MAX_CHARS)}\n\n=== ВЕРСИЯ B (контрагент) ===\n${textB.slice(0, MAX_CHARS)}`,
    model: "smart",
    temperature: 0.2,
    maxTokens: 4096,
  });
  return data;
}
