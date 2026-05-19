import { describe, it, expect } from "vitest";
import {
  calculateRiskScore,
  normalizeStatus,
  type ScoreInput,
} from "../score";

// A counterparty with nothing but the cheapest "basic" data — no
// registration date, no status, no court / debt data. The shared base
// for the status-focused tests below.
const BARE: ScoreInput = {
  activeLawsuits: 0,
  completedLawsuits: 0,
  lossesCount: 0,
  debtFound: false,
};

describe("normalizeStatus", () => {
  it("maps the raw DaData status codes", () => {
    expect(normalizeStatus("ACTIVE")).toBe("active");
    expect(normalizeStatus("REORGANIZING")).toBe("reorganizing");
    expect(normalizeStatus("LIQUIDATING")).toBe("liquidating");
    expect(normalizeStatus("LIQUIDATED")).toBe("liquidated");
    expect(normalizeStatus("BANKRUPT")).toBe("bankrupt");
  });

  it("is case- and whitespace-insensitive", () => {
    expect(normalizeStatus("  active ")).toBe("active");
    expect(normalizeStatus("Liquidating")).toBe("liquidating");
  });

  it("returns 'unknown' for missing or unrecognised input", () => {
    expect(normalizeStatus(undefined)).toBe("unknown");
    expect(normalizeStatus(null)).toBe("unknown");
    expect(normalizeStatus("")).toBe("unknown");
    expect(normalizeStatus("UNKNOWN")).toBe("unknown");
    expect(normalizeStatus("что-то странное")).toBe("unknown");
  });

  it("defensively understands Russian labels (EGRUL passthrough)", () => {
    expect(normalizeStatus("действующее")).toBe("active");
    expect(normalizeStatus("в стадии реорганизации")).toBe("reorganizing");
    expect(normalizeStatus("Банкрот")).toBe("bankrupt");
  });

  it("distinguishes liquidation in progress from a finished one", () => {
    // "ликвидирована" (done) must win over the "ликвид*" in-progress
    // prefixes — otherwise a finished liquidation reads as ongoing.
    expect(normalizeStatus("ликвидирована")).toBe("liquidated");
    expect(normalizeStatus("ликвидация")).toBe("liquidating");
    expect(normalizeStatus("в процессе ликвидации")).toBe("liquidating");
    expect(normalizeStatus("ликвидируется")).toBe("liquidating");
  });
});

describe("calculateRiskScore — baseline", () => {
  it("scores a bare counterparty at the neutral 15", () => {
    // 30 baseline -5 (no active lawsuits) -10 (no debt) = 15.
    const r = calculateRiskScore(BARE);
    expect(r.score).toBe(15);
    expect(r.level).toBe("low");
    expect(r.factors).toEqual([]);
  });

  it("rewards an established company", () => {
    const old = new Date();
    old.setFullYear(old.getFullYear() - 8);
    const r = calculateRiskScore({
      ...BARE,
      registrationDate: old.toISOString(),
    });
    expect(r.score).toBe(5); // 30 -10 -5 -10
    expect(r.level).toBe("low");
  });

  it("flags a very young company", () => {
    const recent = new Date();
    recent.setMonth(recent.getMonth() - 2);
    const r = calculateRiskScore({
      ...BARE,
      registrationDate: recent.toISOString(),
    });
    expect(r.score).toBe(30); // 30 +15 -5 -10
    expect(r.factors).toContain(
      "Компания зарегистрирована недавно (меньше полугода)"
    );
  });

  it("ignores an unparseable registration date", () => {
    const r = calculateRiskScore({ ...BARE, registrationDate: "не дата" });
    expect(r.score).toBe(15);
  });
});

describe("calculateRiskScore — status drives the score (the reported bug)", () => {
  // Regression: the score used to compare statusCode against Russian
  // labels while the providers feed it raw codes, so the status branch
  // never fired and every counterparty came back at a flat 15.

  it("an active company stays low risk", () => {
    const r = calculateRiskScore({ ...BARE, statusCode: "ACTIVE" });
    expect(r.score).toBe(10); // 30 -5 -5 -10
    expect(r.level).toBe("low");
  });

  it("a liquidating company is high risk, never low", () => {
    const r = calculateRiskScore({ ...BARE, statusCode: "LIQUIDATING" });
    expect(r.score).toBe(65); // 30 +50 -5 -10
    expect(r.level).toBe("high");
    expect(r.factors).toContain("Компания в процессе ликвидации");
  });

  it("a liquidated company is critical", () => {
    const r = calculateRiskScore({ ...BARE, statusCode: "LIQUIDATED" });
    expect(r.score).toBe(90); // 30 +75 -5 -10
    expect(r.level).toBe("critical");
    expect(r.factors).toContain("Компания ликвидирована");
  });

  it("a bankrupt company is critical", () => {
    const r = calculateRiskScore({ ...BARE, statusCode: "BANKRUPT" });
    expect(r.score).toBe(95); // 30 +80 -5 -10
    expect(r.level).toBe("critical");
    expect(r.factors).toContain("Компания признана банкротом");
  });

  it("a reorganizing company is medium risk", () => {
    const r = calculateRiskScore({ ...BARE, statusCode: "REORGANIZING" });
    expect(r.score).toBe(40); // 30 +25 -5 -10
    expect(r.level).toBe("medium");
    expect(r.factors).toContain("Компания в процессе реорганизации");
  });

  it("a worrying status always outranks an active one", () => {
    const active = calculateRiskScore({ ...BARE, statusCode: "ACTIVE" });
    for (const bad of ["REORGANIZING", "LIQUIDATING", "LIQUIDATED", "BANKRUPT"]) {
      const r = calculateRiskScore({ ...BARE, statusCode: bad });
      expect(r.score).toBeGreaterThan(active.score);
      expect(r.level).not.toBe("low");
    }
  });

  it("reacts to a Russian status label the same as the raw code", () => {
    expect(calculateRiskScore({ ...BARE, statusCode: "ликвидация" })).toEqual(
      calculateRiskScore({ ...BARE, statusCode: "LIQUIDATING" })
    );
    expect(calculateRiskScore({ ...BARE, statusCode: "Банкрот" })).toEqual(
      calculateRiskScore({ ...BARE, statusCode: "BANKRUPT" })
    );
  });

  it("a liquidating company stays high even when otherwise spotless", () => {
    // Old, no lawsuits, no debt — the most favourable other factors.
    const old = new Date();
    old.setFullYear(old.getFullYear() - 12);
    const r = calculateRiskScore({
      ...BARE,
      statusCode: "LIQUIDATING",
      registrationDate: old.toISOString(),
    });
    expect(r.level).toBe("high"); // 30 +50 -10 -5 -10 = 55
  });
});

describe("calculateRiskScore — court and debt signals", () => {
  it("caps the active-lawsuits contribution at +20", () => {
    const r = calculateRiskScore({ ...BARE, activeLawsuits: 100 });
    expect(r.score).toBe(40); // 30 +20 -10
    expect(r.factors).toContain("Есть открытые судебные споры");
  });

  it("caps the lost-cases contribution at +20", () => {
    const r = calculateRiskScore({
      ...BARE,
      completedLawsuits: 50,
      lossesCount: 50,
    });
    expect(r.score).toBe(35); // 30 -5 +20 -10
    expect(r.factors).toContain("Есть проигранные судебные дела");
  });

  it("escalates to critical when every red flag is present", () => {
    const recent = new Date();
    recent.setMonth(recent.getMonth() - 1);
    const r = calculateRiskScore({
      registrationDate: recent.toISOString(),
      statusCode: "LIQUIDATED",
      activeLawsuits: 5,
      completedLawsuits: 10,
      lossesCount: 8,
      debtFound: true,
      debtAmount: BigInt(10_000_000),
    });
    expect(r.score).toBe(100); // clamped
    expect(r.level).toBe("critical");
    expect(r.factors).toEqual(
      expect.arrayContaining([
        "Компания зарегистрирована недавно (меньше полугода)",
        "Компания ликвидирована",
        "Есть открытые судебные споры",
        "Есть проигранные судебные дела",
        "Найдена задолженность (исполнительные производства)",
      ])
    );
  });

  it("clamps the score into [0, 100]", () => {
    const floor = calculateRiskScore({
      ...BARE,
      statusCode: "ACTIVE",
      registrationDate: new Date(2000, 0, 1).toISOString(),
    });
    expect(floor.score).toBeGreaterThanOrEqual(0);

    const ceiling = calculateRiskScore({
      statusCode: "LIQUIDATED",
      activeLawsuits: 99,
      completedLawsuits: 99,
      lossesCount: 99,
      debtFound: true,
    });
    expect(ceiling.score).toBeLessThanOrEqual(100);
  });
});
