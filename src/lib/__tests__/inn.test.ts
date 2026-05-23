import { describe, it, expect } from "vitest";
import { normalizeInn, validateInn, innKindLabel } from "@/lib/inn";

describe("normalizeInn", () => {
  it("strips spaces and punctuation", () => {
    expect(normalizeInn("7707 083 893")).toBe("7707083893");
    expect(normalizeInn("ИНН: 7707083893")).toBe("7707083893");
  });

  it("handles empty / nullish input", () => {
    expect(normalizeInn("")).toBe("");
    // @ts-expect-error — defensive against runtime nulls
    expect(normalizeInn(null)).toBe("");
  });
});

describe("validateInn — legal entity (10 digits)", () => {
  it("accepts a real 10-digit ИНН", () => {
    // Сбербанк — a well-known valid ИНН.
    const r = validateInn("7707083893");
    expect(r.valid).toBe(true);
    expect(r.kind).toBe("legal");
    expect(r.normalized).toBe("7707083893");
  });

  it("rejects a 10-digit number with a bad check digit", () => {
    const r = validateInn("7707083890");
    expect(r.valid).toBe(false);
    expect(r.kind).toBeNull();
    expect(r.error).toContain("Контрольная сумма");
  });
});

describe("validateInn — individual / ИП (12 digits)", () => {
  it("accepts a valid 12-digit ИНН", () => {
    const r = validateInn("500100732259");
    expect(r.valid).toBe(true);
    expect(r.kind).toBe("individual");
  });

  it("rejects a 12-digit number with bad control digits", () => {
    const r = validateInn("500100732251");
    expect(r.valid).toBe(false);
    expect(r.kind).toBeNull();
  });
});

describe("validateInn — length and emptiness", () => {
  it("rejects empty input", () => {
    expect(validateInn("").error).toBe("Введите ИНН");
  });

  it("rejects 11-digit input as wrong length", () => {
    const r = validateInn("12345678901");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("10 цифр");
  });

  it("normalises before validating", () => {
    expect(validateInn("7707 083 893").valid).toBe(true);
  });
});

describe("innKindLabel", () => {
  it("labels both kinds in Russian", () => {
    expect(innKindLabel("legal")).toBe("организация");
    expect(innKindLabel("individual")).toBe("ИП / физлицо");
  });
});
