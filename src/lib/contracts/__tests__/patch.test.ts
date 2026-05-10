import { describe, it, expect } from "vitest";
import { applyRefinePatch, patchSizeRatio } from "../patch";

const SAMPLE_DOC = `ДОГОВОР ОКАЗАНИЯ УСЛУГ № _____

г. Москва                                                    1 мая 2026 г.

ООО «Заказчик», ИНН 7712345678, именуемое в дальнейшем «Заказчик»,
и ООО «Исполнитель», ИНН 7712345679, именуемое в дальнейшем
«Исполнитель», заключили настоящий Договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА

1.1. Исполнитель обязуется оказать Заказчику услуги по разработке.

1.2. Срок оказания услуг: 30 (тридцать) календарных дней.

2. ЦЕНА И ПОРЯДОК РАСЧЁТОВ

2.1. Стоимость услуг составляет 100 000 (сто тысяч) рублей.

2.2. Оплата производится в течение 5 банковских дней.

3. ОТВЕТСТВЕННОСТЬ

3.1. За просрочку оплаты Заказчик уплачивает неустойку 0,1% в день.`;

describe("applyRefinePatch — replace", () => {
  it("substitutes a unique anchor", () => {
    const result = applyRefinePatch(SAMPLE_DOC, [
      {
        op: "replace",
        find: "1.2. Срок оказания услуг: 30 (тридцать) календарных дней.",
        replace: "1.2. Срок оказания услуг: 60 (шестьдесят) календарных дней.",
      },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain("60 (шестьдесят)");
      expect(result.result).not.toContain("30 (тридцать) календарных");
      expect(result.appliedOps).toHaveLength(1);
    }
  });

  it("rejects an anchor that doesn't exist", () => {
    const result = applyRefinePatch(SAMPLE_DOC, [
      {
        op: "replace",
        find: "Этого текста в документе нет",
        replace: "что угодно",
      },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedAt).toBe(1);
      expect(result.reason).toContain("не найден");
    }
  });

  it("rejects an anchor that occurs multiple times", () => {
    // "Заказчик" appears many times in the sample.
    const result = applyRefinePatch(SAMPLE_DOC, [
      { op: "replace", find: "Заказчик", replace: "ЗАКАЗЧИК" },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/раз/);
    }
  });
});

describe("applyRefinePatch — insert_after", () => {
  it("inserts a new clause after a section anchor", () => {
    const result = applyRefinePatch(SAMPLE_DOC, [
      {
        op: "insert_after",
        anchor: "1.2. Срок оказания услуг: 30 (тридцать) календарных дней.",
        text: "1.3. Услуги оказываются дистанционно.",
      },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain("1.3. Услуги оказываются дистанционно.");
      // Order check: new clause must appear AFTER the anchor.
      const anchorIdx = result.result.indexOf("1.2. Срок");
      const insertedIdx = result.result.indexOf("1.3. Услуги");
      expect(insertedIdx).toBeGreaterThan(anchorIdx);
    }
  });

  it("preserves the section before the anchor unchanged", () => {
    const result = applyRefinePatch(SAMPLE_DOC, [
      {
        op: "insert_after",
        anchor: "1.2. Срок оказания услуг: 30 (тридцать) календарных дней.",
        text: "1.3. New clause.",
      },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain("1.1. Исполнитель обязуется");
    }
  });
});

describe("applyRefinePatch — insert_before", () => {
  it("inserts before the anchor", () => {
    const result = applyRefinePatch(SAMPLE_DOC, [
      {
        op: "insert_before",
        anchor: "2. ЦЕНА И ПОРЯДОК РАСЧЁТОВ",
        text: "1.3. Дополнительный пункт перед новым разделом.",
      },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const insertedIdx = result.result.indexOf("Дополнительный пункт");
      const sectionIdx = result.result.indexOf("2. ЦЕНА");
      expect(insertedIdx).toBeLessThan(sectionIdx);
    }
  });
});

describe("applyRefinePatch — delete", () => {
  it("removes a clause cleanly", () => {
    const result = applyRefinePatch(SAMPLE_DOC, [
      {
        op: "delete",
        find: "2.2. Оплата производится в течение 5 банковских дней.",
      },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).not.toContain("2.2. Оплата производится");
      // Surrounding sections still present.
      expect(result.result).toContain("2.1. Стоимость");
      expect(result.result).toContain("3. ОТВЕТСТВЕННОСТЬ");
    }
  });
});

describe("applyRefinePatch — sequencing", () => {
  it("applies multiple ops in order", () => {
    const result = applyRefinePatch(SAMPLE_DOC, [
      {
        op: "replace",
        find: "1.2. Срок оказания услуг: 30 (тридцать) календарных дней.",
        replace: "1.2. Срок оказания услуг: 90 (девяносто) календарных дней.",
      },
      {
        op: "insert_after",
        anchor: "3.1. За просрочку оплаты Заказчик уплачивает неустойку 0,1% в день.",
        text: "3.2. Размер неустойки не может превышать 10% от суммы договора.",
      },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toContain("90 (девяносто)");
      expect(result.result).toContain("3.2. Размер неустойки");
      expect(result.appliedOps).toHaveLength(2);
    }
  });

  it("aborts on first failure — never partially applied", () => {
    const result = applyRefinePatch(SAMPLE_DOC, [
      {
        op: "replace",
        find: "1.2. Срок оказания услуг: 30 (тридцать) календарных дней.",
        replace: "1.2. Срок оказания услуг: 90 (девяносто) календарных дней.",
      },
      {
        op: "replace",
        find: "ЭТОГО ТЕКСТА НЕТ",
        replace: "x",
      },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedAt).toBe(2); // 1-based index of the failed op
    }
  });

  it("rejects an empty operation list", () => {
    const result = applyRefinePatch(SAMPLE_DOC, []);
    expect(result.ok).toBe(false);
  });
});

describe("patchSizeRatio", () => {
  it("returns ~0 for tiny edits", () => {
    const ratio = patchSizeRatio("a".repeat(1000), [
      { op: "replace", find: "a", replace: "b" },
    ]);
    expect(ratio).toBeLessThan(0.01);
  });

  it("returns >0.5 when ops nearly rewrite the doc", () => {
    const source = "x".repeat(100);
    const ratio = patchSizeRatio(source, [
      { op: "replace", find: "x".repeat(100), replace: "y".repeat(80) },
    ]);
    expect(ratio).toBeGreaterThan(0.5);
  });
});
