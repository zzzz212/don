import { describe, it, expect } from "vitest";
import {
  dedupRisks,
  riskDedupKey,
  byRiskSeverity,
  RISK_PRIORITY,
} from "../dedup";
import type { AnalysisRisk } from "../schemas/analyze";

function risk(partial: Partial<AnalysisRisk>): AnalysisRisk {
  return {
    clauseNumber: "п. 1",
    clauseTitle: "Заголовок",
    level: "medium",
    description: "Описание",
    legalReference: "ст. 1 ГК РФ",
    originalText: "оригинальный текст",
    recommendedText: "рекомендуемый",
    recommendation: "действие",
    ...partial,
  };
}

describe("RISK_PRIORITY", () => {
  it("orders critical < medium < low", () => {
    expect(RISK_PRIORITY.critical).toBeLessThan(RISK_PRIORITY.medium);
    expect(RISK_PRIORITY.medium).toBeLessThan(RISK_PRIORITY.low);
  });
});

describe("riskDedupKey", () => {
  it("normalises clause number and the first 50 chars of cited text", () => {
    const a = risk({ clauseNumber: "  П. 5.2  ", originalText: "  Текст  " });
    const b = risk({ clauseNumber: "п. 5.2", originalText: "ТЕКСТ" });
    expect(riskDedupKey(a)).toBe(riskDedupKey(b));
  });

  it("differentiates by clause number", () => {
    const a = risk({ clauseNumber: "п. 1" });
    const b = risk({ clauseNumber: "п. 2" });
    expect(riskDedupKey(a)).not.toBe(riskDedupKey(b));
  });

  it("treats different originalText prefixes as distinct", () => {
    const a = risk({ originalText: "альфа " + "x".repeat(80) });
    const b = risk({ originalText: "бета " + "x".repeat(80) });
    expect(riskDedupKey(a)).not.toBe(riskDedupKey(b));
  });

  it("treats originalText that differs only past 50 chars as identical", () => {
    const head = "общий префикс длиной более пятидесяти символов точно";
    const a = risk({ originalText: head + " конец A" });
    const b = risk({ originalText: head + " конец B" });
    expect(a.originalText.slice(0, 50)).toBe(b.originalText.slice(0, 50));
    expect(riskDedupKey(a)).toBe(riskDedupKey(b));
  });
});

describe("dedupRisks", () => {
  it("keeps unique risks unchanged", () => {
    const risks = [
      risk({ clauseNumber: "п. 1" }),
      risk({ clauseNumber: "п. 2" }),
      risk({ clauseNumber: "п. 3" }),
    ];
    expect(dedupRisks(risks)).toHaveLength(3);
  });

  it("collapses duplicates by (clauseNumber + originalText prefix)", () => {
    const r = risk({ clauseNumber: "п. 5.2", originalText: "alpha" });
    const dupe = risk({ clauseNumber: "п. 5.2", originalText: "alpha" });
    expect(dedupRisks([r, dupe])).toHaveLength(1);
  });

  it("keeps the higher severity when duplicates clash", () => {
    const lowDup = risk({
      clauseNumber: "п. 5.2",
      originalText: "alpha",
      level: "low",
    });
    const criticalDup = risk({
      clauseNumber: "п. 5.2",
      originalText: "alpha",
      level: "critical",
    });

    // Order doesn't matter — critical always wins
    expect(dedupRisks([lowDup, criticalDup])[0].level).toBe("critical");
    expect(dedupRisks([criticalDup, lowDup])[0].level).toBe("critical");
  });

  it("handles 3-way severity conflicts deterministically", () => {
    const low = risk({
      clauseNumber: "п. 1",
      originalText: "x",
      level: "low",
    });
    const med = risk({
      clauseNumber: "п. 1",
      originalText: "x",
      level: "medium",
    });
    const crit = risk({
      clauseNumber: "п. 1",
      originalText: "x",
      level: "critical",
    });
    const all = [low, med, crit];
    expect(dedupRisks(all)).toHaveLength(1);
    expect(dedupRisks(all)[0].level).toBe("critical");
  });

  it("returns a fresh array (no shared reference)", () => {
    const risks = [risk({})];
    expect(dedupRisks(risks)).not.toBe(risks);
  });
});

describe("byRiskSeverity comparator", () => {
  it("sorts critical first, low last", () => {
    const sorted = [
      risk({ level: "low" }),
      risk({ level: "critical" }),
      risk({ level: "medium" }),
    ].sort(byRiskSeverity);

    expect(sorted.map((r) => r.level)).toEqual([
      "critical",
      "medium",
      "low",
    ]);
  });

  it("is stable for same-level entries", () => {
    const a = risk({ level: "medium", clauseTitle: "A" });
    const b = risk({ level: "medium", clauseTitle: "B" });
    const c = risk({ level: "medium", clauseTitle: "C" });
    const sorted = [a, b, c].sort(byRiskSeverity);
    expect(sorted.map((r) => r.clauseTitle)).toEqual(["A", "B", "C"]);
  });
});
