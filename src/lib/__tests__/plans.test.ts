import { describe, it, expect } from "vitest";
import {
  PLANS,
  DEFAULT_PLAN,
  PLAN_LIMITS,
  UNLIMITED,
  normalizePlan,
  getPlanLimits,
  isUnlimited,
} from "../plans";

describe("PLANS / DEFAULT_PLAN", () => {
  it("exposes exactly FREE / PRO / BUSINESS", () => {
    expect(PLANS).toEqual(["FREE", "PRO", "BUSINESS"]);
  });

  it("defaults to FREE", () => {
    expect(DEFAULT_PLAN).toBe("FREE");
  });

  it("has limits for every plan", () => {
    for (const plan of PLANS) {
      expect(PLAN_LIMITS[plan]).toBeDefined();
      expect(PLAN_LIMITS[plan]).toHaveProperty("analyze");
      expect(PLAN_LIMITS[plan]).toHaveProperty("generate");
      expect(PLAN_LIMITS[plan]).toHaveProperty("chat");
      expect(PLAN_LIMITS[plan]).toHaveProperty("ocr");
    }
  });
});

describe("normalizePlan", () => {
  it("returns the canonical plan when given a known string", () => {
    expect(normalizePlan("FREE")).toBe("FREE");
    expect(normalizePlan("PRO")).toBe("PRO");
    expect(normalizePlan("BUSINESS")).toBe("BUSINESS");
  });

  it("falls back to DEFAULT_PLAN for null / undefined / empty", () => {
    expect(normalizePlan(null)).toBe(DEFAULT_PLAN);
    expect(normalizePlan(undefined)).toBe(DEFAULT_PLAN);
    expect(normalizePlan("")).toBe(DEFAULT_PLAN);
  });

  it("falls back to DEFAULT_PLAN for unknown strings", () => {
    expect(normalizePlan("ENTERPRISE")).toBe(DEFAULT_PLAN);
    expect(normalizePlan("free")).toBe(DEFAULT_PLAN); // case-sensitive
    expect(normalizePlan("hacker")).toBe(DEFAULT_PLAN);
  });
});

describe("getPlanLimits", () => {
  it("returns the exact limits for FREE", () => {
    const limits = getPlanLimits("FREE");
    expect(limits.analyze).toBe(3);
    expect(limits.generate).toBe(2);
    expect(isUnlimited(limits.chat)).toBe(true);
    expect(limits.ocr).toBe(0); // OCR gated to paid
  });

  it("returns UNLIMITED for all PRO features", () => {
    const limits = getPlanLimits("PRO");
    expect(isUnlimited(limits.analyze)).toBe(true);
    expect(isUnlimited(limits.generate)).toBe(true);
    expect(isUnlimited(limits.chat)).toBe(true);
    expect(isUnlimited(limits.ocr)).toBe(true);
  });

  it("BUSINESS is at least as permissive as PRO", () => {
    const pro = getPlanLimits("PRO");
    const biz = getPlanLimits("BUSINESS");
    for (const f of ["analyze", "generate", "chat", "ocr"] as const) {
      if (isUnlimited(pro[f])) {
        expect(isUnlimited(biz[f])).toBe(true);
      } else {
        expect(biz[f]).toBeGreaterThanOrEqual(pro[f]);
      }
    }
  });
});

describe("isUnlimited / UNLIMITED", () => {
  it("UNLIMITED is the infinity sentinel", () => {
    expect(isUnlimited(UNLIMITED)).toBe(true);
    expect(Number.isFinite(UNLIMITED)).toBe(false);
  });

  it("finite numbers are not unlimited", () => {
    expect(isUnlimited(0)).toBe(false);
    expect(isUnlimited(3)).toBe(false);
    expect(isUnlimited(Number.MAX_SAFE_INTEGER)).toBe(false);
  });
});
