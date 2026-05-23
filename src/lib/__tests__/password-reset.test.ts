import { describe, it, expect } from "vitest";
import {
  hashResetToken,
  PASSWORD_RESET_VALIDITY_HUMAN,
  MIN_PASSWORD_LEN,
} from "../password-reset";

// The DB-touching parts (request / consume) are exercised by the
// integration test plan and Vercel deployment smoke test. Pure helpers
// that don't need Prisma are pinned here so refactors can't accidentally
// downgrade their security properties.

describe("hashResetToken", () => {
  it("produces a 64-char SHA-256 hex digest", () => {
    const h = hashResetToken("hello");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic — same input → same output", () => {
    expect(hashResetToken("abc")).toBe(hashResetToken("abc"));
  });

  it("differs for distinct inputs", () => {
    expect(hashResetToken("a")).not.toBe(hashResetToken("b"));
  });

  it("never returns the plaintext", () => {
    const plaintext = "totally-not-a-secret";
    expect(hashResetToken(plaintext)).not.toContain(plaintext);
  });
});

describe("password-reset constants", () => {
  it("validity copy is human-readable Russian", () => {
    expect(PASSWORD_RESET_VALIDITY_HUMAN).toContain("минут");
  });

  it("MIN_PASSWORD_LEN matches the registration rule (≥6) so reset can't bypass it", () => {
    expect(MIN_PASSWORD_LEN).toBeGreaterThanOrEqual(6);
  });
});
