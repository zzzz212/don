import { describe, it, expect } from "vitest";
import {
  generateTotpSecret,
  buildOtpauthUri,
  verifyTotpCode,
  generateRecoveryCodes,
  hashRecoveryCode,
  consumeRecoveryCode,
  generateTotpForTesting,
} from "../totp";

describe("generateTotpSecret", () => {
  it("returns a non-empty base32 string", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBeGreaterThanOrEqual(16);
  });

  it("returns a different secret each call", () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).not.toBe(b);
  });
});

describe("buildOtpauthUri", () => {
  it("includes the account label and issuer", () => {
    const uri = buildOtpauthUri("ABCDEFGHIJ234567", "user@example.com");
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("user%40example.com");
    expect(uri).toContain("issuer=");
    expect(uri).toContain("secret=ABCDEFGHIJ234567");
  });
});

describe("verifyTotpCode", () => {
  it("rejects non-6-digit input", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode("12345", secret)).toBe(false);
    expect(verifyTotpCode("1234567", secret)).toBe(false);
    expect(verifyTotpCode("abcdef", secret)).toBe(false);
    expect(verifyTotpCode("", secret)).toBe(false);
  });

  it("strips whitespace before checking", () => {
    const secret = generateTotpSecret();
    const code = generateTotpForTesting(secret);
    expect(verifyTotpCode(`${code.slice(0, 3)} ${code.slice(3)}`, secret)).toBe(
      true
    );
  });

  it("accepts a code generated for the matching secret", () => {
    const secret = generateTotpSecret();
    const code = generateTotpForTesting(secret);
    expect(verifyTotpCode(code, secret)).toBe(true);
  });

  it("rejects a code generated for a different secret", () => {
    const secretA = generateTotpSecret();
    const secretB = generateTotpSecret();
    const code = generateTotpForTesting(secretA);
    expect(verifyTotpCode(code, secretB)).toBe(false);
  });
});

describe("recovery codes", () => {
  it("generates exactly 10 plaintext + 10 hashes by default", () => {
    const { plaintext, hashed } = generateRecoveryCodes();
    expect(plaintext).toHaveLength(10);
    expect(hashed).toHaveLength(10);
  });

  it("plaintext codes are formatted as xxxx-xxxx (8 hex + 1 dash)", () => {
    const { plaintext } = generateRecoveryCodes();
    for (const code of plaintext) {
      expect(code).toMatch(/^[0-9a-f]{4}-[0-9a-f]{4}$/);
    }
  });

  it("each plaintext code is unique within the set", () => {
    const { plaintext } = generateRecoveryCodes();
    expect(new Set(plaintext).size).toBe(plaintext.length);
  });

  it("hashes are SHA-256 (64 hex chars)", () => {
    const { hashed } = generateRecoveryCodes();
    for (const h of hashed) {
      expect(h).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("hashRecoveryCode is whitespace + dash tolerant", () => {
    const a = hashRecoveryCode("a1b2-c3d4");
    const b = hashRecoveryCode("a1b2c3d4");
    const c = hashRecoveryCode("a1b2 c3d4");
    const d = hashRecoveryCode("A1B2-C3D4");
    expect(a).toBe(b);
    expect(a).toBe(c);
    expect(a).toBe(d);
  });

  it("consumeRecoveryCode returns null when no match", () => {
    const { hashed } = generateRecoveryCodes();
    const result = consumeRecoveryCode("0000-0000", hashed);
    expect(result).toBeNull();
  });

  it("consumeRecoveryCode removes the matching hash on success", () => {
    const { plaintext, hashed } = generateRecoveryCodes();
    const result = consumeRecoveryCode(plaintext[3], hashed);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(hashed.length - 1);
    // The matched hash should be gone
    expect(result).not.toContain(hashRecoveryCode(plaintext[3]));
  });

  it("consumeRecoveryCode is case + whitespace insensitive", () => {
    const { plaintext, hashed } = generateRecoveryCodes();
    const original = plaintext[0];
    const munged = original.toUpperCase().replace("-", " ");
    const result = consumeRecoveryCode(munged, hashed);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(hashed.length - 1);
  });
});
