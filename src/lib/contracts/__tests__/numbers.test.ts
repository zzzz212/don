import { describe, it, expect } from "vitest";
import {
  rublesInWords,
  formatRubles,
  moneyDisplay,
  dateInWords,
  todayInWords,
} from "../numbers";

// formatRubles emits a non-ASCII thousands separator (foot-gun #16) —
// normalize any whitespace to a plain space before string comparison.
const norm = (s: string) => s.replace(/\s/g, " ");

describe("rublesInWords", () => {
  it("handles zero", () => {
    expect(rublesInWords(0)).toBe("ноль рублей 00 копеек");
  });

  it("renders units in masculine gender for whole rubles", () => {
    expect(rublesInWords(1)).toBe("Один рубль 00 копеек");
    expect(rublesInWords(2)).toBe("Два рубля 00 копеек");
    expect(rublesInWords(5)).toBe("Пять рублей 00 копеек");
  });

  it("renders the teens range", () => {
    expect(rublesInWords(11)).toBe("Одиннадцать рублей 00 копеек");
    expect(rublesInWords(19)).toBe("Девятнадцать рублей 00 копеек");
  });

  it("renders tens and hundreds", () => {
    expect(rublesInWords(45)).toBe("Сорок пять рублей 00 копеек");
    expect(rublesInWords(100)).toBe("Сто рублей 00 копеек");
    expect(rublesInWords(999)).toBe(
      "Девятьсот девяносто девять рублей 00 копеек"
    );
  });

  it("uses feminine gender for the thousands group (тысяча, not тысяч)", () => {
    // "одна тысяча" / "две тысячи" — тысяча is feminine, unlike рубль,
    // so the units inside the thousands triplet switch gender.
    expect(rublesInWords(1000)).toBe("Одна тысяча рублей 00 копеек");
    expect(rublesInWords(2000)).toBe("Две тысячи рублей 00 копеек");
    expect(rublesInWords(5000)).toBe("Пять тысяч рублей 00 копеек");
  });

  it("renders millions and billions", () => {
    expect(rublesInWords(1_000_000)).toBe("Один миллион рублей 00 копеек");
    expect(rublesInWords(2_000_000)).toBe("Два миллиона рублей 00 копеек");
    expect(rublesInWords(1_000_000_000)).toBe(
      "Один миллиард рублей 00 копеек"
    );
  });

  it("derives kopecks from the fractional part", () => {
    expect(rublesInWords(10.5)).toBe("Десять рублей 50 копеек");
    expect(rublesInWords(0.01)).toBe("ноль рублей 01 копеек");
    expect(rublesInWords(99.99)).toBe("Девяносто девять рублей 99 копеек");
  });

  it("applies the correct plural form to the ruble word", () => {
    expect(rublesInWords(21)).toContain("рубль"); // ...один рубль
    expect(rublesInWords(22)).toContain("рубля");
    expect(rublesInWords(25)).toContain("рублей");
    expect(rublesInWords(111)).toContain("рублей"); // 11-14 exception
  });

  it("guards against negative and non-finite input", () => {
    expect(rublesInWords(-5)).toBe("ноль рублей 00 копеек");
    expect(rublesInWords(NaN)).toBe("ноль рублей 00 копеек");
    expect(rublesInWords(Infinity)).toBe("ноль рублей 00 копеек");
  });

  it("composes every group for a large mixed amount", () => {
    expect(rublesInWords(1_234_567)).toBe(
      "Один миллион двести тридцать четыре тысячи пятьсот шестьдесят семь рублей 00 копеек"
    );
  });
});

describe("formatRubles", () => {
  it("groups thousands", () => {
    expect(norm(formatRubles(1000))).toBe("1 000");
    expect(norm(formatRubles(1_234_567))).toBe("1 234 567");
  });

  it("leaves sub-thousand values ungrouped", () => {
    expect(formatRubles(500)).toBe("500");
  });

  it("uses a non-ASCII whitespace separator (foot-gun #16)", () => {
    // The separator is a Unicode space, not U+0020 — code comparing
    // formatted output to a hand-typed string must normalize first.
    const sep = formatRubles(1000).charAt(1);
    expect(sep).not.toBe(" "); // not a plain ASCII space
    expect(sep.trim()).toBe(""); // but still whitespace
  });
});

describe("moneyDisplay", () => {
  it("combines the grouped digits and the sum-in-words", () => {
    expect(norm(moneyDisplay(150000))).toBe(
      "150 000 (Сто пятьдесят тысяч рублей 00 копеек)"
    );
  });
});

describe("dateInWords", () => {
  it("formats an ISO date in Russian with the month name", () => {
    expect(dateInWords("2026-05-19")).toBe("«19» мая 2026 года");
  });

  it("strips the leading zero from the day", () => {
    expect(dateInWords("2026-01-05")).toBe("«5» января 2026 года");
  });

  it("returns an empty string for empty input", () => {
    expect(dateInWords("")).toBe("");
  });

  it("returns the raw input when the month is out of range", () => {
    expect(dateInWords("2026-13-01")).toBe("2026-13-01");
    expect(dateInWords("2026-00-01")).toBe("2026-00-01");
  });
});

describe("todayInWords", () => {
  it("produces a well-formed Russian date string", () => {
    expect(todayInWords()).toMatch(/^«\d{1,2}» \S+ \d{4} года$/);
  });
});
