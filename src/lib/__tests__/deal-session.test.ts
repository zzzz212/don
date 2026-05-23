import { describe, it, expect } from "vitest";
import { generateDealSessionId, DEAL_SESSION_COOKIE } from "../deal-session";

describe("generateDealSessionId", () => {
  it("returns a 32-char hex string (128 bits)", () => {
    const id = generateDealSessionId();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it("is different across calls", () => {
    expect(generateDealSessionId()).not.toBe(generateDealSessionId());
  });
});

describe("DEAL_SESSION_COOKIE", () => {
  it("exports the expected cookie name", () => {
    expect(DEAL_SESSION_COOKIE).toBe("yakso_deal_session");
  });
});
