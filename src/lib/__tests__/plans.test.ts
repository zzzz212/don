import { describe, it, expect } from "vitest";
import {
  PLANS,
  DEFAULT_PLAN,
  PLAN_LIMITS,
  UNLIMITED,
  normalizePlan,
  getPlanLimits,
  isUnlimited,
  getEffectivePlan,
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

describe("getEffectivePlan", () => {
  const NOW = new Date("2026-05-10T12:00:00Z");
  const FUTURE = new Date("2026-05-20T12:00:00Z"); // 10 days ahead
  const PAST = new Date("2026-05-01T12:00:00Z"); // 9 days behind

  it("returns the stored plan when no trial is set", () => {
    const e = getEffectivePlan({ plan: "FREE", trialEndsAt: null }, NOW);
    expect(e.plan).toBe("FREE");
    expect(e.baselinePlan).toBe("FREE");
    expect(e.isTrial).toBe(false);
    expect(e.trialDaysLeft).toBeNull();
  });

  it("upgrades FREE to PRO during an active trial", () => {
    const e = getEffectivePlan({ plan: "FREE", trialEndsAt: FUTURE }, NOW);
    expect(e.plan).toBe("PRO");
    expect(e.baselinePlan).toBe("FREE");
    expect(e.isTrial).toBe(true);
    expect(e.trialDaysLeft).toBe(10);
  });

  it("falls back to FREE when the trial has expired", () => {
    const e = getEffectivePlan({ plan: "FREE", trialEndsAt: PAST }, NOW);
    expect(e.plan).toBe("FREE");
    expect(e.isTrial).toBe(false);
    expect(e.trialDaysLeft).toBeNull();
  });

  it("does NOT downgrade an already-paid plan during a stale trial flag", () => {
    // Defensive: if a paid customer somehow has a trialEndsAt set, the
    // paid plan still wins.
    const e = getEffectivePlan({ plan: "PRO", trialEndsAt: FUTURE }, NOW);
    expect(e.plan).toBe("PRO");
    expect(e.baselinePlan).toBe("PRO");
    expect(e.isTrial).toBe(false);
  });

  it("rounds up the days-left counter (so 'less than a day' shows as 1)", () => {
    const trialEndsAt = new Date(NOW.getTime() + 1000); // 1 second left
    const e = getEffectivePlan({ plan: "FREE", trialEndsAt }, NOW);
    expect(e.trialDaysLeft).toBe(1);
  });

  it("trial of exactly 14 days at start shows 14", () => {
    const trialEndsAt = new Date(NOW.getTime() + 14 * 24 * 60 * 60 * 1000);
    const e = getEffectivePlan({ plan: "FREE", trialEndsAt }, NOW);
    expect(e.trialDaysLeft).toBe(14);
  });
});
