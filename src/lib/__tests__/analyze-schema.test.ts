import { describe, it, expect } from "vitest";
import { AnalysisRiskSchema, AnalysisResultSchema } from "../ai/schemas/analyze";

describe("AnalysisResultSchema score coercion (Anthropic string-number regression)", () => {
  const baseResult = {
    summary: "ok",
    contractType: "услуг",
    parties: "А и Б",
    verdict: "sign" as const,
    verdictReason: "...",
    risks: [],
    notarization: { required: false, reason: "" },
    registration: { required: false, reason: "" },
    missingClauses: [],
    preSigningChecklist: [],
  };

  it("accepts score as a plain number", () => {
    const r = AnalysisResultSchema.safeParse({ ...baseResult, score: 7 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.score).toBe(7);
  });

  it("coerces score from a quoted string '8' to number 8", () => {
    // Production incident: Anthropic occasionally returns `"score": "8"`
    // — a quoted number — under high-token-pressure prompts. Without
    // z.coerce, that single wrinkle 500's the whole analyze flow.
    const r = AnalysisResultSchema.safeParse({ ...baseResult, score: "8" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.score).toBe(8);
  });

  it("still rejects non-numeric score strings", () => {
    const r = AnalysisResultSchema.safeParse({ ...baseResult, score: "high" });
    expect(r.success).toBe(false);
  });

  it("still enforces the 1..10 integer range after coercion", () => {
    expect(AnalysisResultSchema.safeParse({ ...baseResult, score: "15" }).success).toBe(false);
    expect(AnalysisResultSchema.safeParse({ ...baseResult, score: "0" }).success).toBe(false);
    expect(AnalysisResultSchema.safeParse({ ...baseResult, score: "5.5" }).success).toBe(false);
  });
});

describe("AnalysisRiskSchema with counterPerspective", () => {
  const baseRisk = {
    clauseNumber: "1.2",
    clauseTitle: "Срок поставки",
    level: "critical" as const,
    description: "Штраф 0.5%/день",
    legalReference: "ст. 333 ГК РФ",
    originalText: "Срок поставки — 30 дней",
    recommendedText: "Срок поставки — 45 дней",
    recommendation: "Увеличить срок",
  };

  it("accepts a risk without counterPerspective (back-compat)", () => {
    const result = AnalysisRiskSchema.safeParse(baseRisk);
    expect(result.success).toBe(true);
  });

  it("accepts a risk with counterPerspective", () => {
    const withCP = {
      ...baseRisk,
      counterPerspective: {
        theirGain: "Регулярный денежный поток при просрочке",
        compromise: "0.1%, потолок 5%",
      },
    };
    const result = AnalysisRiskSchema.safeParse(withCP);
    expect(result.success).toBe(true);
  });

  it("accepts counterPerspective without compromise (optional inside optional)", () => {
    const withTheirGainOnly = {
      ...baseRisk,
      counterPerspective: { theirGain: "Жёсткая защита от просрочки" },
    };
    const result = AnalysisRiskSchema.safeParse(withTheirGainOnly);
    expect(result.success).toBe(true);
  });

  it("rejects counterPerspective without theirGain", () => {
    const broken = {
      ...baseRisk,
      counterPerspective: { compromise: "0.1%" },
    };
    const result = AnalysisRiskSchema.safeParse(broken);
    expect(result.success).toBe(false);
    if (!result.success) {
      // Pin the failing path so weakening `theirGain` to .optional()
      // would actually fail this test, not pass silently.
      expect(
        result.error.issues.some((i) => i.path.includes("theirGain"))
      ).toBe(true);
    }
  });
});
