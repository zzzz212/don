import { describe, it, expect } from "vitest";
import { findVerbatimQuote, verifyRiskQuotes } from "../quote-verify";
import type { AnalysisRisk } from "../schemas/analyze";

// Contract text with a line break and a run of spaces inside one clause —
// exactly the whitespace the model tends to flatten when it "quotes".
const CONTRACT = `5.1. Арендатор обязан вносить
арендную   плату не позднее 5-го числа каждого месяца.
5.2. Арендодатель вправе в одностороннем порядке расторгнуть договор.`;

function risk(originalText: string): AnalysisRisk {
  return {
    clauseNumber: "5.1",
    clauseTitle: "Тест",
    level: "medium",
    description: "описание",
    legalReference: "ст. 1 ГК РФ",
    originalText,
    recommendedText: "рекомендуемый текст",
    recommendation: "что делать",
  };
}

describe("findVerbatimQuote", () => {
  it("returns the quote unchanged when it already appears verbatim", () => {
    const q =
      "Арендодатель вправе в одностороннем порядке расторгнуть договор.";
    expect(findVerbatimQuote(CONTRACT, q)).toBe(q);
  });

  it("snaps a whitespace-flattened quote back to the exact contract text", () => {
    // The model collapsed the line break and the run of spaces.
    const q =
      "Арендатор обязан вносить арендную плату не позднее 5-го числа каждого месяца.";
    const found = findVerbatimQuote(CONTRACT, q);
    expect(found).not.toBeNull();
    // The whole point: the snapped quote is now an exact substring.
    expect(CONTRACT.includes(found as string)).toBe(true);
    // ...and it kept the contract's original line break.
    expect(found).toContain("\n");
  });

  it("returns null when the quote was paraphrased, not flattened", () => {
    expect(
      findVerbatimQuote(CONTRACT, "Арендатор платит аренду до пятого числа")
    ).toBeNull();
  });

  it("returns null for a short non-matching quote (noise guard)", () => {
    // Not an exact substring, and too short to fuzzy-match safely.
    expect(findVerbatimQuote(CONTRACT, "абвгде")).toBeNull();
  });
});

describe("verifyRiskQuotes", () => {
  it("repairs a whitespace-mismatched quote so the contract contains it", () => {
    const [out] = verifyRiskQuotes(CONTRACT, [
      risk(
        "Арендатор обязан вносить арендную плату не позднее 5-го числа каждого месяца."
      ),
    ]);
    expect(CONTRACT.includes(out.originalText)).toBe(true);
  });

  it("leaves an already-exact quote untouched", () => {
    const exact =
      "Арендодатель вправе в одностороннем порядке расторгнуть договор.";
    const [out] = verifyRiskQuotes(CONTRACT, [risk(exact)]);
    expect(out.originalText).toBe(exact);
  });

  it("leaves a paraphrased quote untouched — no regression vs. before", () => {
    const para = "Арендатор платит аренду до пятого числа месяца";
    const [out] = verifyRiskQuotes(CONTRACT, [risk(para)]);
    expect(out.originalText).toBe(para);
  });

  it("preserves the other fields of a repaired risk", () => {
    const [out] = verifyRiskQuotes(CONTRACT, [
      risk(
        "Арендатор обязан вносить арендную плату не позднее 5-го числа каждого месяца."
      ),
    ]);
    expect(out.clauseNumber).toBe("5.1");
    expect(out.legalReference).toBe("ст. 1 ГК РФ");
  });
});
