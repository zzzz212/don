// Zod schema for the AI-refine "patch mode" output. Instead of asking
// the model to regenerate the whole document (output tokens proportional
// to document length), we ask it to describe its edit as a small list of
// operations against anchor strings. Output is typically <500 tokens vs
// 5000-15000 for full regen, which is the whole point.

import { z } from "zod";

export const RefineOperationSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("replace"),
    find: z
      .string()
      .min(15)
      .describe(
        "Точный фрагмент исходного документа, который нужно заменить. Должен встречаться ровно один раз."
      ),
    replace: z
      .string()
      .describe("Новый текст. Может быть пустой строкой (тогда фрагмент удаляется)."),
  }),
  z.object({
    op: z.literal("insert_after"),
    anchor: z
      .string()
      .min(15)
      .describe(
        "Точный фрагмент документа, после которого вставить новый текст. Должен встречаться один раз."
      ),
    text: z.string().min(1).describe("Текст для вставки."),
  }),
  z.object({
    op: z.literal("insert_before"),
    anchor: z
      .string()
      .min(15)
      .describe(
        "Точный фрагмент документа, перед которым вставить новый текст. Должен встречаться один раз."
      ),
    text: z.string().min(1).describe("Текст для вставки."),
  }),
  z.object({
    op: z.literal("delete"),
    find: z
      .string()
      .min(15)
      .describe(
        "Точный фрагмент документа, который нужно удалить. Должен встречаться один раз."
      ),
  }),
]);

export const RefinePatchSchema = z.object({
  /**
   * Set true when the instruction violates Russian law (e.g. asks to
   * exclude liability for intentional harm — ст. 401 ГК РФ) or is
   * ambiguous to the point where applying it would damage the contract.
   * Operations are ignored in that case.
   */
  refused: z
    .boolean()
    .describe(
      "true если инструкция противоречит закону РФ или невыполнима. operations при этом будут проигнорированы."
    ),
  refusalReason: z
    .string()
    .describe(
      "Краткое обоснование отказа на русском, если refused=true. Иначе пустая строка."
    ),
  operations: z
    .array(RefineOperationSchema)
    .describe(
      "Список операций правки. Применяются последовательно. Если правка слишком обширна для разбиения на операции — верни refused=true и reason='правка слишком велика, нужна полная перегенерация'."
    ),
  summary: z
    .string()
    .describe(
      "Однострочное описание сделанных изменений на русском (для истории версий)."
    ),
});

export type RefinePatch = z.infer<typeof RefinePatchSchema>;
