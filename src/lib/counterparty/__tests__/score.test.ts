import { describe, it, expect } from "vitest";
import { calculateRiskScore } from "../score";

describe("calculateRiskScore", () => {
  it("starts from a neutral 30 baseline", () => {
    const r = calculateRiskScore({
      activeLawsuits: 0,
      completedLawsuits: 0,
      lossesCount: 0,
      debtFound: false,
    });
    // -5 (no active lawsuits) -10 (no debt) = 15
    expect(r.score).toBe(15);
    expect(r.level).toBe("low");
    expect(r.factors).toEqual([]);
  });

  it("rewards established companies", () => {
    const oldDate = new Date();
    oldDate.setFullYear(oldDate.getFullYear() - 8);
    const r = calculateRiskScore({
      registrationDate: oldDate.toISOString(),
      activeLawsuits: 0,
      completedLawsuits: 0,
      lossesCount: 0,
      debtFound: false,
    });
    expect(r.score).toBe(5); // 30 -10 -5 -10 = 5
    expect(r.level).toBe("low");
  });

  it("flags very young companies", () => {
    const recent = new Date();
    recent.setMonth(recent.getMonth() - 2);
    const r = calculateRiskScore({
      registrationDate: recent.toISOString(),
      activeLawsuits: 0,
      completedLawsuits: 0,
      lossesCount: 0,
      debtFound: false,
    });
    // 30 +15 (recent) -5 (no lawsuits) -10 (no debt) = 30
    expect(r.score).toBe(30);
    expect(r.factors).toContain("registration_recent");
  });

  it("treats liquidation as severe", () => {
    const r = calculateRiskScore({
      statusCode: "ликвидация",
      activeLawsuits: 0,
      completedLawsuits: 0,
      lossesCount: 0,
      debtFound: false,
    });
    // 30 +30 (liquidation) -5 (no lawsuits) -10 (no debt) = 45
    expect(r.score).toBe(45);
    expect(r.level).toBe("medium");
    expect(r.factors).toContain("liquidation");
  });

  it("caps active-lawsuits contribution at +20", () => {
    const r = calculateRiskScore({
      activeLawsuits: 100,
      completedLawsuits: 0,
      lossesCount: 0,
      debtFound: false,
    });
    // 30 +20 (cap) -10 (no debt) = 40
    expect(r.score).toBe(40);
    expect(r.factors).toContain("active_lawsuits");
  });

  it("caps lost-cases contribution at +20", () => {
    const r = calculateRiskScore({
      activeLawsuits: 0,
      completedLawsuits: 50,
      lossesCount: 50,
      debtFound: false,
    });
    // 30 -5 (no active) +20 (cap) -10 (no debt) = 35
    expect(r.score).toBe(35);
    expect(r.factors).toContain("lost_cases");
  });

  it("escalates to critical for liquidation + active lawsuits + debt", () => {
    const recent = new Date();
    recent.setMonth(recent.getMonth() - 1);
    const r = calculateRiskScore({
      registrationDate: recent.toISOString(),
      statusCode: "ликвидирована",
      activeLawsuits: 5,
      completedLawsuits: 10,
      lossesCount: 8,
      debtFound: true,
      debtAmount: BigInt(10_000_000),
    });
    expect(r.score).toBe(100);
    expect(r.level).toBe("critical");
    expect(r.factors).toEqual(
      expect.arrayContaining([
        "registration_recent",
        "liquidation",
        "active_lawsuits",
        "lost_cases",
        "debt",
      ])
    );
  });

  it("clamps the score to [0, 100]", () => {
    const r1 = calculateRiskScore({
      activeLawsuits: 0,
      completedLawsuits: 0,
      lossesCount: 0,
      debtFound: false,
      statusCode: "активна",
      registrationDate: new Date(2000, 0, 1).toISOString(),
    });
    expect(r1.score).toBeGreaterThanOrEqual(0);

    const r2 = calculateRiskScore({
      statusCode: "ликвидация",
      activeLawsuits: 99,
      completedLawsuits: 99,
      lossesCount: 99,
      debtFound: true,
    });
    expect(r2.score).toBeLessThanOrEqual(100);
  });

  it("maps score thresholds to levels correctly", () => {
    // boundary: 25 → low
    expect(
      calculateRiskScore({
        activeLawsuits: 0,
        completedLawsuits: 0,
        lossesCount: 0,
        debtFound: false,
      }).level
    ).toBe("low");

    // 30-50 medium (just liquidation pushes to 45)
    expect(
      calculateRiskScore({
        statusCode: "ликвидация",
        activeLawsuits: 0,
        completedLawsuits: 0,
        lossesCount: 0,
        debtFound: false,
      }).level
    ).toBe("medium");
  });
});
