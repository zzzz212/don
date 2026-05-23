import { describe, it, expect } from "vitest";
import { parseDocument } from "../parsers";

// `File` is a Node global (>= 20) and vitest runs under Node, so real
// File objects can be built without a browser environment. These tests
// exercise the extension-routing logic and the .txt path; PDF / DOCX
// parsing delegates to third-party libraries and is out of scope here.

describe("parseDocument — extension routing", () => {
  it("parses a .txt file as UTF-8 plain text", async () => {
    const result = await parseDocument(
      new File(["Договор оказания услуг"], "contract.txt")
    );
    expect(result.text).toBe("Договор оказания услуг");
    expect(result.mimeType).toBe("text/plain");
  });

  it("matches the extension case-insensitively", async () => {
    const result = await parseDocument(new File(["hello"], "CONTRACT.TXT"));
    expect(result.text).toBe("hello");
  });

  it("rejects an unsupported extension with a clear Russian error", async () => {
    await expect(
      parseDocument(new File(["data"], "contract.rtf"))
    ).rejects.toThrow("Неподдерживаемый формат файла: .rtf");
  });

  it("treats a file with no extension as unsupported", async () => {
    await expect(
      parseDocument(new File(["data"], "contract"))
    ).rejects.toThrow(/Неподдерживаемый формат/);
  });

  it("preserves UTF-8 content including Cyrillic and punctuation", async () => {
    const text = "Стороны: ООО «Альфа» — ИП Петров. Сумма — 100 000 ₽.";
    const result = await parseDocument(new File([text], "x.txt"));
    expect(result.text).toBe(text);
  });
});
