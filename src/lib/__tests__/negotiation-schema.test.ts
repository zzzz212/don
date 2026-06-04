import { describe, it, expect } from "vitest";
import { MovesSchema } from "../ai/schemas/negotiation";

describe("MovesSchema", () => {
  const validA = {
    id: "A" as const,
    title: "Согласиться",
    body: "Под формулировкой… это безопасно потому что…",
    proposedText: null,
  };
  const validB = {
    id: "B" as const,
    title: "Компромисс",
    body: "Снизить штраф до 0.1% и cap'нуть на 5%",
    proposedText: "Неустойка составляет 0.1% за каждый день просрочки, но не более 5% от суммы договора.",
  };
  const validC = {
    id: "C" as const,
    title: "Стоять на своём",
    body: "Текущая формулировка защищает от…",
    proposedText: null,
  };

  it("accepts exactly 3 moves with correct ids A, B, C", () => {
    const result = MovesSchema.safeParse({ moves: [validA, validB, validC] });
    expect(result.success).toBe(true);
  });

  it("rejects fewer than 3 moves", () => {
    const result = MovesSchema.safeParse({ moves: [validA, validB] });
    expect(result.success).toBe(false);
  });

  it("rejects more than 3 moves", () => {
    const result = MovesSchema.safeParse({
      moves: [validA, validB, validC, validA],
    });
    expect(result.success).toBe(false);
  });

  it("accepts null proposedText", () => {
    const result = MovesSchema.safeParse({
      moves: [validA, validB, { ...validC, proposedText: null }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts omitted proposedText (treated as undefined)", () => {
    const { proposedText: _omitted, ...withoutPt } = validC;
    const result = MovesSchema.safeParse({
      moves: [validA, validB, withoutPt],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = MovesSchema.safeParse({
      moves: [{ ...validA, title: "" }, validB, validC],
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown id value", () => {
    const result = MovesSchema.safeParse({
      moves: [{ ...validA, id: "D" }, validB, validC],
    });
    expect(result.success).toBe(false);
  });
});
