import { describe, it, expect } from "vitest";
import { FREE_CHAT_CAP, isOverFreeChatCap } from "../free-cap";

describe("FREE_CHAT_CAP", () => {
  it("is 10 — matches the documented FREE daily chat-feature cap", () => {
    // Pinned: the negotiation suggest-moves UI promises "10 в день" for FREE.
    expect(FREE_CHAT_CAP).toBe(10);
  });
});

describe("isOverFreeChatCap — only FREE plans are capped", () => {
  it("returns false for paid plans regardless of usage", () => {
    expect(isOverFreeChatCap("PRO_SOLO", 9999)).toBe(false);
    expect(isOverFreeChatCap("PRO_TEAM", 9999)).toBe(false);
    expect(isOverFreeChatCap("BUSINESS", 9999)).toBe(false);
    // legacy "PRO" rows alias to a paid tier — never capped
    expect(isOverFreeChatCap("PRO", 9999)).toBe(false);
  });

  it("caps FREE at the boundary: 9 used is allowed, 10 used is over", () => {
    expect(isOverFreeChatCap("FREE", 0)).toBe(false);
    expect(isOverFreeChatCap("FREE", 9)).toBe(false);
    expect(isOverFreeChatCap("FREE", 10)).toBe(true);
    expect(isOverFreeChatCap("FREE", 11)).toBe(true);
  });

  it("treats an unknown / missing plan as FREE — fail closed, never grant free spend", () => {
    // A typo'd or future plan string must NOT escape the cap.
    expect(isOverFreeChatCap("ENTERPRISE", 10)).toBe(true);
    expect(isOverFreeChatCap(null, 10)).toBe(true);
    expect(isOverFreeChatCap(undefined, 10)).toBe(true);
    expect(isOverFreeChatCap("", 10)).toBe(true);
    // but below the cap an unknown plan is still allowed
    expect(isOverFreeChatCap("ENTERPRISE", 9)).toBe(false);
  });
});
