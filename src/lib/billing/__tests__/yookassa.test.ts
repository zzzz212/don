import { describe, it, expect } from "vitest";
import { kopecksToYookassaValue, YookassaClient } from "../yookassa";

describe("kopecksToYookassaValue", () => {
  it("formats whole rubles with .00 fractional", () => {
    expect(kopecksToYookassaValue(0)).toBe("0.00");
    expect(kopecksToYookassaValue(100)).toBe("1.00");
    expect(kopecksToYookassaValue(399000)).toBe("3990.00");
  });

  it("formats partial-ruble amounts with two-digit fractional", () => {
    expect(kopecksToYookassaValue(101)).toBe("1.01");
    expect(kopecksToYookassaValue(199)).toBe("1.99");
    expect(kopecksToYookassaValue(50)).toBe("0.50");
  });

  it("never produces single-digit fractional (ЮKassa would reject)", () => {
    for (const k of [1, 10, 99, 100, 1000]) {
      const v = kopecksToYookassaValue(k);
      expect(v).toMatch(/\.\d{2}$/);
    }
  });

  it("throws on negative or non-integer kopecks (defensive)", () => {
    expect(() => kopecksToYookassaValue(-1)).toThrow();
    expect(() => kopecksToYookassaValue(1.5)).toThrow();
  });

  it("matches ЮKassa's expected format for the BUSINESS price", () => {
    expect(kopecksToYookassaValue(14990 * 100)).toBe("14990.00");
  });
});

describe("YookassaClient.fromEnv", () => {
  it("returns null when credentials are absent", () => {
    const o1 = process.env.YOOKASSA_SHOP_ID;
    const o2 = process.env.YOOKASSA_SECRET_KEY;
    delete process.env.YOOKASSA_SHOP_ID;
    delete process.env.YOOKASSA_SECRET_KEY;
    try {
      expect(YookassaClient.fromEnv()).toBeNull();
    } finally {
      if (o1 !== undefined) process.env.YOOKASSA_SHOP_ID = o1;
      if (o2 !== undefined) process.env.YOOKASSA_SECRET_KEY = o2;
    }
  });

  it("returns a client when both creds are present", () => {
    const o1 = process.env.YOOKASSA_SHOP_ID;
    const o2 = process.env.YOOKASSA_SECRET_KEY;
    process.env.YOOKASSA_SHOP_ID = "test-shop";
    process.env.YOOKASSA_SECRET_KEY = "test-secret";
    try {
      const client = YookassaClient.fromEnv();
      expect(client).toBeInstanceOf(YookassaClient);
    } finally {
      if (o1 === undefined) delete process.env.YOOKASSA_SHOP_ID;
      else process.env.YOOKASSA_SHOP_ID = o1;
      if (o2 === undefined) delete process.env.YOOKASSA_SECRET_KEY;
      else process.env.YOOKASSA_SECRET_KEY = o2;
    }
  });
});
