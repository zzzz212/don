import { describe, it, expect } from "vitest";
import {
  BRAND,
  OPERATOR,
  CONTACTS,
  PRICING_RUB,
  PRICING_KOPECKS,
  PLAN_LABEL,
  isOperatorPlaceholder,
  isPaidPlan,
  planLabel,
} from "../legal-info";

// legal-info drives the legally-binding public pages (/offer, /privacy,
// /terms) and ЮKassa receipts. These tests are a launch guard: they fail
// loudly if the operator details regress to placeholders or the pricing
// tables drift apart.

describe("operator details — launch guard (foot-gun #20)", () => {
  it("the operator is no longer a placeholder", () => {
    expect(isOperatorPlaceholder()).toBe(false);
  });

  it("no operator string field still carries the '[' placeholder marker", () => {
    for (const [key, value] of Object.entries(OPERATOR)) {
      if (typeof value === "string") {
        expect(
          value.startsWith("["),
          `OPERATOR.${key} looks like a placeholder`
        ).toBe(false);
      }
    }
  });

  it("ИНН is a 12-digit ИП identifier", () => {
    expect(OPERATOR.inn).toMatch(/^\d{12}$/);
  });

  it("ОГРНИП is a 15-digit identifier", () => {
    expect(OPERATOR.ogrn).toMatch(/^\d{15}$/);
  });

  it("the legal name and registered address are filled in", () => {
    expect(OPERATOR.legalName.length).toBeGreaterThan(10);
    expect(OPERATOR.registeredAddress.length).toBeGreaterThan(10);
  });
});

describe("brand and contacts", () => {
  it("publicUrl is an https URL on the brand domain", () => {
    expect(BRAND.publicUrl).toBe(`https://${BRAND.domain}`);
  });

  it("every contact address is on the brand domain", () => {
    for (const addr of Object.values(CONTACTS)) {
      expect(addr.endsWith(`@${BRAND.domain}`)).toBe(true);
    }
  });
});

describe("pricing tables stay consistent", () => {
  it("kopeck amounts are exactly the ruble amounts multiplied by 100", () => {
    for (const plan of ["PRO_SOLO", "PRO_TEAM", "BUSINESS", "PRO"] as const) {
      expect(PRICING_KOPECKS[plan]).toBe(PRICING_RUB[plan] * 100);
    }
  });

  it("kopeck amounts are whole integers (no float drift)", () => {
    for (const v of Object.values(PRICING_KOPECKS)) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("legacy 'PRO' is priced and labelled identically to PRO_SOLO", () => {
    expect(PRICING_RUB.PRO).toBe(PRICING_RUB.PRO_SOLO);
    expect(PLAN_LABEL.PRO).toBe(PLAN_LABEL.PRO_SOLO);
  });

  it("paid tiers are strictly ordered by price", () => {
    expect(PRICING_RUB.PRO_SOLO).toBeLessThan(PRICING_RUB.PRO_TEAM);
    expect(PRICING_RUB.PRO_TEAM).toBeLessThan(PRICING_RUB.BUSINESS);
  });
});

describe("isPaidPlan", () => {
  it("accepts every paid plan code including the legacy alias", () => {
    expect(isPaidPlan("PRO_SOLO")).toBe(true);
    expect(isPaidPlan("PRO_TEAM")).toBe(true);
    expect(isPaidPlan("BUSINESS")).toBe(true);
    expect(isPaidPlan("PRO")).toBe(true);
  });

  it("rejects FREE and unknown strings", () => {
    expect(isPaidPlan("FREE")).toBe(false);
    expect(isPaidPlan("")).toBe(false);
    expect(isPaidPlan("pro_solo")).toBe(false); // case-sensitive
  });
});

describe("planLabel", () => {
  it("returns the human label for known plans", () => {
    expect(planLabel("FREE")).toBe("Старт");
    expect(planLabel("PRO_SOLO")).toBe("Pro Solo");
    expect(planLabel("BUSINESS")).toBe("Бизнес");
  });

  it("maps the legacy 'PRO' to the PRO_SOLO label", () => {
    expect(planLabel("PRO")).toBe("Pro Solo");
  });

  it("falls back to the FREE label for null / undefined", () => {
    expect(planLabel(null)).toBe("Старт");
    expect(planLabel(undefined)).toBe("Старт");
  });

  it("echoes an unrecognised plan code rather than throwing", () => {
    expect(planLabel("ENTERPRISE")).toBe("ENTERPRISE");
  });
});
