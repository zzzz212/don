import { describe, it, expect } from "vitest";
import {
  bulkFileError,
  MAX_BULK_FILES,
  MAX_BULK_FILE_BYTES,
  BULK_ALLOWED_EXTENSIONS,
} from "../bulk";

describe("bulkFileError", () => {
  it("accepts every supported extension, case-insensitively", () => {
    expect(bulkFileError({ name: "contract.pdf", size: 1000 })).toBeNull();
    expect(bulkFileError({ name: "contract.docx", size: 1000 })).toBeNull();
    expect(bulkFileError({ name: "contract.doc", size: 1000 })).toBeNull();
    expect(bulkFileError({ name: "CONTRACT.PDF", size: 1000 })).toBeNull();
    expect(bulkFileError({ name: "many.dots.in.name.txt", size: 1000 })).toBeNull();
  });

  it("rejects an unsupported or missing extension", () => {
    expect(bulkFileError({ name: "contract.rtf", size: 1000 })).toMatch(/Формат/);
    expect(bulkFileError({ name: "noextension", size: 1000 })).toMatch(/Формат/);
  });

  it("rejects a file over the 10 MB ceiling", () => {
    expect(
      bulkFileError({ name: "big.pdf", size: MAX_BULK_FILE_BYTES + 1 })
    ).toMatch(/10 МБ/);
  });

  it("accepts a file sitting exactly on the size ceiling", () => {
    expect(
      bulkFileError({ name: "edge.pdf", size: MAX_BULK_FILE_BYTES })
    ).toBeNull();
  });

  it("rejects an empty file", () => {
    expect(bulkFileError({ name: "empty.pdf", size: 0 })).toMatch(/пуст/);
  });

  it("reports the format problem before the size problem", () => {
    // A wrong-extension oversized file surfaces the more fundamental
    // error first, so the user fixes the right thing.
    expect(
      bulkFileError({ name: "huge.rtf", size: MAX_BULK_FILE_BYTES + 1 })
    ).toMatch(/Формат/);
  });
});

describe("bulk constants", () => {
  it("caps a run at a tab-realistic number of files", () => {
    expect(MAX_BULK_FILES).toBeGreaterThan(1);
    expect(MAX_BULK_FILES).toBeLessThanOrEqual(50);
  });

  it("the allowed extensions match the analyze pipeline", () => {
    expect([...BULK_ALLOWED_EXTENSIONS].sort()).toEqual([
      "doc",
      "docx",
      "pdf",
      "txt",
    ]);
  });
});
