import { describe, it, expect } from "vitest";
import {
  scoreAndVerdictFromCounts,
  type RiskCounts,
} from "../score-calibration";

// score-calibration is the single source of truth shared by the synthesis
// fallback and the demo provider — a silent drift here ships a wrong
// verdict to users, so the thresholds get pinned exhaustively.

const counts = (critical: number, medium: number, low = 0): RiskCounts => ({
  critical,
  medium,
  low,
});

describe("scoreAndVerdictFromCounts — verdict thresholds", () => {
  it("two critical risks → do_not_sign, score 2", () => {
    const r = scoreAndVerdictFromCounts(counts(2, 0));
    expect(r.verdict).toBe("do_not_sign");
    expect(r.score).toBe(2);
  });

  it("three or more critical risks → do_not_sign, score floored at 1", () => {
    expect(scoreAndVerdictFromCounts(counts(3, 0)).score).toBe(1);
    expect(scoreAndVerdictFromCounts(counts(7, 4)).score).toBe(1);
    expect(scoreAndVerdictFromCounts(counts(7, 4)).verdict).toBe("do_not_sign");
  });

  it("one critical + 3 or more medium → do_not_sign, score 3", () => {
    const r = scoreAndVerdictFromCounts(counts(1, 3));
    expect(r.verdict).toBe("do_not_sign");
    expect(r.score).toBe(3);
  });

  it("one critical with fewer than 3 medium → negotiate, score 4", () => {
    expect(scoreAndVerdictFromCounts(counts(1, 0)).verdict).toBe("negotiate");
    expect(scoreAndVerdictFromCounts(counts(1, 0)).score).toBe(4);
    expect(scoreAndVerdictFromCounts(counts(1, 2)).score).toBe(4);
  });

  it("six or more medium (no critical) → negotiate, score 4", () => {
    const r = scoreAndVerdictFromCounts(counts(0, 6));
    expect(r.verdict).toBe("negotiate");
    expect(r.score).toBe(4);
  });

  it("4-5 medium → negotiate, score 6 then 5", () => {
    expect(scoreAndVerdictFromCounts(counts(0, 4)).score).toBe(6);
    expect(scoreAndVerdictFromCounts(counts(0, 5)).score).toBe(5);
    expect(scoreAndVerdictFromCounts(counts(0, 4)).verdict).toBe("negotiate");
  });

  it("2-3 medium → sign, score 8 then 7", () => {
    expect(scoreAndVerdictFromCounts(counts(0, 2)).score).toBe(8);
    expect(scoreAndVerdictFromCounts(counts(0, 3)).score).toBe(7);
    expect(scoreAndVerdictFromCounts(counts(0, 2)).verdict).toBe("sign");
  });

  it("0-1 medium → sign, score 10 then 9", () => {
    expect(scoreAndVerdictFromCounts(counts(0, 0)).score).toBe(10);
    expect(scoreAndVerdictFromCounts(counts(0, 1)).score).toBe(9);
    expect(scoreAndVerdictFromCounts(counts(0, 0)).verdict).toBe("sign");
  });
});

describe("scoreAndVerdictFromCounts — invariants", () => {
  it("a single critical risk outranks any amount of medium-only noise", () => {
    // Critical is a hard gate, not a weighted sum: one critical risk
    // must never score better than a contract with only medium issues.
    const withCritical = scoreAndVerdictFromCounts(counts(1, 0));
    const noCritical = scoreAndVerdictFromCounts(counts(0, 1));
    expect(withCritical.score).toBeLessThan(noCritical.score);
  });

  it("low-severity risks never affect score or verdict", () => {
    for (const low of [0, 5, 100]) {
      expect(scoreAndVerdictFromCounts(counts(1, 2, low))).toEqual(
        scoreAndVerdictFromCounts(counts(1, 2, 0))
      );
    }
  });

  it("score always lands inside the documented 1-10 band", () => {
    for (let critical = 0; critical <= 5; critical++) {
      for (let medium = 0; medium <= 12; medium++) {
        const { score } = scoreAndVerdictFromCounts(counts(critical, medium));
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(10);
      }
    }
  });

  it("verdict and score stay consistent across the whole input space", () => {
    for (let critical = 0; critical <= 5; critical++) {
      for (let medium = 0; medium <= 12; medium++) {
        const { score, verdict } = scoreAndVerdictFromCounts(
          counts(critical, medium)
        );
        if (verdict === "do_not_sign") expect(score).toBeLessThanOrEqual(3);
        if (verdict === "sign") expect(score).toBeGreaterThanOrEqual(7);
        if (verdict === "negotiate") {
          expect(score).toBeGreaterThanOrEqual(4);
          expect(score).toBeLessThanOrEqual(6);
        }
      }
    }
  });

  it("more medium risks never improve the score (monotonic)", () => {
    let prev = 11;
    for (let medium = 0; medium <= 12; medium++) {
      const { score } = scoreAndVerdictFromCounts(counts(0, medium));
      expect(score).toBeLessThanOrEqual(prev);
      prev = score;
    }
  });

  it("every result carries a human-readable reason", () => {
    expect(scoreAndVerdictFromCounts(counts(2, 0)).verdictReason.length)
      .toBeGreaterThan(10);
    expect(scoreAndVerdictFromCounts(counts(0, 0)).verdictReason.length)
      .toBeGreaterThan(10);
  });
});
