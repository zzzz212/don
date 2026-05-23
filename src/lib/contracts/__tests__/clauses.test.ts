import { describe, it, expect } from "vitest";
import {
  forceMajeure,
  disputeResolution,
  termination,
  finalProvisions,
  confidentiality,
  signatureBlock,
  header,
  preamble,
} from "../clauses";

describe("section numbering", () => {
  it("forceMajeure renders the heading and sub-points with the given number", () => {
    const out = forceMajeure(7);
    expect(out.startsWith("7. ФОРС-МАЖОР")).toBe(true);
    expect(out).toContain("7.1.");
    expect(out).toContain("7.2.");
    expect(out).toContain("7.3.");
  });

  it("every clause builder honours an arbitrary section number", () => {
    expect(disputeResolution(3)).toContain("3. ПОРЯДОК РАЗРЕШЕНИЯ СПОРОВ");
    expect(termination(9)).toContain("9. ИЗМЕНЕНИЕ И РАСТОРЖЕНИЕ");
    expect(finalProvisions(12)).toContain("12. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ");
    expect(confidentiality(4)).toContain("4. КОНФИДЕНЦИАЛЬНОСТЬ");
  });
});

describe("Russian grammar — Договор (masculine) vs Соглашение (neuter)", () => {
  it("defaults to the Договор forms", () => {
    const out = finalProvisions(1);
    expect(out).toContain("Настоящий Договор");
    expect(out).not.toContain("Соглашени");
  });

  it("agrees the predicate adjective with the deal kind", () => {
    // "Договор составлен" (m) vs "Соглашение составлено" (n) — a
    // mismatched predicate adjective reads as a broken document.
    expect(finalProvisions(1, "Договор")).toContain(
      "составлен в двух экземплярах"
    );
    expect(finalProvisions(1, "Соглашение")).toContain(
      "составлено в двух экземплярах"
    );
  });

  it("uppercases the genitive form in the termination heading", () => {
    expect(termination(1, "Договор")).toContain("РАСТОРЖЕНИЕ ДОГОВОРА");
    expect(termination(1, "Соглашение")).toContain("РАСТОРЖЕНИЕ СОГЛАШЕНИЯ");
  });

  it("the Соглашение variant never leaks a masculine Договор form", () => {
    const builders = [
      forceMajeure,
      disputeResolution,
      termination,
      finalProvisions,
      confidentiality,
    ];
    for (const build of builders) {
      const out = build(1, "Соглашение");
      expect(out).not.toContain("Договор");
      expect(out).toContain("Соглашени"); // Соглашение / Соглашения / ...
    }
  });
});

describe("signatureBlock", () => {
  it("includes both party roles, names and the seal marker", () => {
    const out = signatureBlock(
      "Заказчик",
      "ООО «Альфа»",
      "Исполнитель",
      "ИП Петров"
    );
    expect(out).toContain("Заказчик");
    expect(out).toContain("ООО «Альфа»");
    expect(out).toContain("Исполнитель");
    expect(out).toContain("ИП Петров");
    expect(out).toContain("М.П.");
  });

  it("falls back to a blank line when a party name is empty", () => {
    const out = signatureBlock("Сторона 1", "", "Сторона 2", "");
    expect(out).toContain("_______________________");
  });
});

describe("header", () => {
  it("renders the title uppercased with the supplied number", () => {
    const out = header("Договор поставки", "«19» мая 2026 года", "12-А");
    expect(out).toContain("ДОГОВОР ПОСТАВКИ № 12-А");
    expect(out).toContain("«19» мая 2026 года");
    expect(out).toContain("г. Москва");
  });

  it("renders a blank number placeholder when no number is given", () => {
    expect(header("Договор", "сегодня")).toContain("№ _____");
  });
});

describe("preamble", () => {
  it("interpolates both parties, their INNs and roles", () => {
    const out = preamble(
      "ООО «Альфа»",
      "7712345678",
      "Поставщик",
      "ИП Петров",
      "771234567890",
      "Покупатель"
    );
    expect(out).toContain("ООО «Альфа»");
    expect(out).toContain("ИНН 7712345678");
    expect(out).toContain("«Поставщик»");
    expect(out).toContain("ИП Петров");
    expect(out).toContain("«Покупатель»");
  });

  it("uses placeholders for missing party data", () => {
    const out = preamble("", "", "Сторона 1", "", "", "Сторона 2");
    expect(out).toContain("_______________");
  });

  it("agrees 'настоящий/настоящее' with the deal kind", () => {
    expect(preamble("А", "1", "Р1", "Б", "2", "Р2", "Договор")).toContain(
      "настоящий Договор"
    );
    expect(preamble("А", "1", "Р1", "Б", "2", "Р2", "Соглашение")).toContain(
      "настоящее Соглашение"
    );
  });
});
