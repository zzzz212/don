import { describe, it, expect } from "vitest";
import { AnalysisRiskSchema } from "../ai/schemas/analyze";

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
