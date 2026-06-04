import { describe, it, expect } from "vitest";
import { buildShareLinks } from "../deals-share";

describe("buildShareLinks", () => {
  const url = "https://yakso.ru/deal/abc123";
  const title = "Договор оказания услуг";

  it("builds a t.me/share link with url + text params", () => {
    const { telegram } = buildShareLinks(url, title);
    expect(telegram).toBe(
      "https://t.me/share/url?url=https%3A%2F%2Fyakso.ru%2Fdeal%2Fabc123" +
        "&text=" +
        encodeURIComponent(title)
    );
  });

  it("builds a wa.me link with the url folded into the text body", () => {
    const { whatsapp } = buildShareLinks(url, title);
    // WhatsApp has no separate url field — title and url go into one text body.
    expect(whatsapp).toBe(
      "https://wa.me/?text=" + encodeURIComponent(`${title} ${url}`)
    );
  });

  it("percent-encodes Cyrillic, spaces and reserved chars in the title", () => {
    const { telegram, whatsapp } = buildShareLinks(url, "Срок & оплата");
    expect(telegram).toContain("text=%D0%A1%D1%80%D0%BE%D0%BA%20%26%20%D0%BE%D0%BF%D0%BB%D0%B0%D1%82%D0%B0");
    expect(telegram).not.toContain(" ");
    expect(telegram).not.toContain("&text=Срок");
    expect(whatsapp).not.toContain(" ");
  });

  it("percent-encodes the url so query separators can't break the link", () => {
    const { telegram } = buildShareLinks("https://yakso.ru/deal/x?y=1", title);
    expect(telegram).toContain("url=https%3A%2F%2Fyakso.ru%2Fdeal%2Fx%3Fy%3D1");
    // The deal url's own ?/= must be encoded, not leak as outer query params.
    expect(telegram).not.toContain("/deal/x?y=1");
  });

  it("falls back to a generic title when given an empty string", () => {
    const { telegram, whatsapp } = buildShareLinks(url, "   ");
    const expected = encodeURIComponent("Договор на согласование");
    expect(telegram).toContain(`&text=${expected}`);
    expect(whatsapp).toContain(expected);
  });
});
