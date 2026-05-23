import { describe, it, expect } from "vitest";
import { pickTier, type AiAction } from "../tier-policy";

const ACTIONS: AiAction[] = ["analyze", "generate", "refine", "chat"];

describe("pickTier — FREE tier runs the cheap model everywhere", () => {
  it.each(ACTIONS)("'%s' on FREE → fast (Haiku)", (action) => {
    expect(pickTier(action, "FREE")).toBe("fast");
  });
});

describe("pickTier — paid tiers", () => {
  it.each(ACTIONS)("'%s' on PRO → smart", (action) => {
    expect(pickTier(action, "PRO")).toBe("smart");
  });

  it("BUSINESS escalates to deep (Opus) only on analyze", () => {
    expect(pickTier("analyze", "BUSINESS")).toBe("deep");
    expect(pickTier("generate", "BUSINESS")).toBe("smart");
    expect(pickTier("refine", "BUSINESS")).toBe("smart");
    expect(pickTier("chat", "BUSINESS")).toBe("smart");
  });

  it("PRO_SOLO and PRO_TEAM resolve to the same row as legacy PRO", () => {
    for (const action of ACTIONS) {
      const pro = pickTier(action, "PRO");
      expect(pickTier(action, "PRO_SOLO")).toBe(pro);
      expect(pickTier(action, "PRO_TEAM")).toBe(pro);
    }
  });
});

describe("pickTier — unknown / missing plan defaults to FREE", () => {
  it("null, undefined and empty string fall back to the FREE row", () => {
    expect(pickTier("analyze", null)).toBe("fast");
    expect(pickTier("analyze", undefined)).toBe("fast");
    expect(pickTier("analyze", "")).toBe("fast");
  });

  it("an unrecognised plan code never grants an expensive tier", () => {
    // Safety: a typo'd or future plan string must not silently spend on
    // Sonnet/Opus — fall back to the cheapest model instead.
    expect(pickTier("analyze", "ENTERPRISE")).toBe("fast");
    expect(pickTier("analyze", "pro")).toBe("fast"); // case-sensitive
    expect(pickTier("analyze", "BUSINESS ")).toBe("fast"); // trailing space
  });

  it("'deep' is reachable ONLY through BUSINESS + analyze", () => {
    const plans = [
      "FREE",
      "PRO",
      "PRO_SOLO",
      "PRO_TEAM",
      "BUSINESS",
      "junk",
      null,
      undefined,
    ];
    for (const action of ACTIONS) {
      for (const plan of plans) {
        const tier = pickTier(action, plan);
        if (tier === "deep") {
          expect(action).toBe("analyze");
          expect(plan).toBe("BUSINESS");
        }
      }
    }
  });
});
