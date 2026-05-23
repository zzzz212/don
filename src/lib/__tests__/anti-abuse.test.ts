import { describe, it, expect } from "vitest";
import {
  emailDomain,
  isDisposableEmail,
  normalizeEmailForDedup,
  hashFingerprint,
  assessAbuse,
  SUSPICIOUS_THRESHOLD,
} from "@/lib/anti-abuse";

describe("emailDomain", () => {
  it("extracts the lowercased domain", () => {
    expect(emailDomain("Ivan@Company.RU")).toBe("company.ru");
  });
  it("returns empty for malformed input", () => {
    expect(emailDomain("not-an-email")).toBe("");
  });
});

describe("isDisposableEmail", () => {
  it("flags known disposable providers", () => {
    expect(isDisposableEmail("x@mailinator.com")).toBe(true);
    expect(isDisposableEmail("a.b@10minutemail.com")).toBe(true);
  });
  it("allows real providers", () => {
    expect(isDisposableEmail("ceo@gmail.com")).toBe(false);
    expect(isDisposableEmail("legal@yandex.ru")).toBe(false);
  });
});

describe("normalizeEmailForDedup", () => {
  it("drops Gmail dots and +aliases", () => {
    expect(normalizeEmailForDedup("j.o.hn+promo@gmail.com")).toBe(
      "john@gmail.com"
    );
    expect(normalizeEmailForDedup("john@googlemail.com")).toBe(
      "john@googlemail.com"
    );
  });
  it("keeps dots for non-Gmail domains but still drops +aliases", () => {
    expect(normalizeEmailForDedup("ivan.petrov+x@yandex.ru")).toBe(
      "ivan.petrov@yandex.ru"
    );
  });
  it("lowercases", () => {
    expect(normalizeEmailForDedup("Ivan@Company.RU")).toBe("ivan@company.ru");
  });
  it("maps Gmail dot variants to the same key", () => {
    expect(normalizeEmailForDedup("a.b.c@gmail.com")).toBe(
      normalizeEmailForDedup("abc@gmail.com")
    );
  });
});

describe("hashFingerprint", () => {
  it("is stable for the same input", () => {
    expect(hashFingerprint("device-x")).toBe(hashFingerprint("device-x"));
  });
  it("differs for different inputs", () => {
    expect(hashFingerprint("device-x")).not.toBe(hashFingerprint("device-y"));
  });
  it("maps empty / nullish input to empty string", () => {
    expect(hashFingerprint("")).toBe("");
    expect(hashFingerprint(null)).toBe("");
    expect(hashFingerprint(undefined)).toBe("");
  });
});

describe("assessAbuse", () => {
  it("scores a clean activation at zero", () => {
    const r = assessAbuse({ ipCluster: 0, fingerprintCluster: 0 });
    expect(r.score).toBe(0);
    expect(r.suspicious).toBe(false);
    expect(r.flags).toHaveLength(0);
  });

  it("treats a fingerprint collision as strongly suspicious", () => {
    const r = assessAbuse({ ipCluster: 0, fingerprintCluster: 2 });
    expect(r.score).toBeGreaterThanOrEqual(SUSPICIOUS_THRESHOLD);
    expect(r.suspicious).toBe(true);
    expect(r.flags.join(" ")).toContain("сигнатура устройства");
  });

  it("does not flag a small IP cluster (NAT tolerance)", () => {
    const r = assessAbuse({ ipCluster: 2, fingerprintCluster: 0 });
    expect(r.suspicious).toBe(false);
    expect(r.flags).toHaveLength(0);
  });

  it("flags a large IP cluster", () => {
    const r = assessAbuse({ ipCluster: 5, fingerprintCluster: 0 });
    expect(r.flags.join(" ")).toContain("IP");
  });

  it("caps the score at 100", () => {
    const r = assessAbuse({ ipCluster: 50, fingerprintCluster: 50 });
    expect(r.score).toBe(100);
  });
});
