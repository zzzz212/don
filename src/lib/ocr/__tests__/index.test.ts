import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getOcr,
  isOcrAvailable,
  __resetOcrCache,
  OcrError,
} from "../index";

describe("getOcr factory", () => {
  const originalKey = process.env.YANDEX_OCR_API_KEY;
  const originalFolder = process.env.YANDEX_OCR_FOLDER_ID;

  beforeEach(() => {
    delete process.env.YANDEX_OCR_API_KEY;
    delete process.env.YANDEX_OCR_FOLDER_ID;
    __resetOcrCache();
  });

  afterEach(() => {
    if (originalKey !== undefined)
      process.env.YANDEX_OCR_API_KEY = originalKey;
    else delete process.env.YANDEX_OCR_API_KEY;
    if (originalFolder !== undefined)
      process.env.YANDEX_OCR_FOLDER_ID = originalFolder;
    else delete process.env.YANDEX_OCR_FOLDER_ID;
    __resetOcrCache();
  });

  it("returns noop when neither env is set", () => {
    const p = getOcr();
    expect(p.name).toBe("noop");
    expect(p.available).toBe(false);
    expect(p.inlineLimitBytes).toBe(0);
    expect(isOcrAvailable()).toBe(false);
  });

  it("returns noop when only the key is set", () => {
    process.env.YANDEX_OCR_API_KEY = "real-key";
    __resetOcrCache();
    expect(getOcr().name).toBe("noop");
  });

  it("returns noop when only the folder is set", () => {
    process.env.YANDEX_OCR_FOLDER_ID = "real-folder";
    __resetOcrCache();
    expect(getOcr().name).toBe("noop");
  });

  it("activates yandex when both env vars are non-placeholder", () => {
    process.env.YANDEX_OCR_API_KEY = "real-key-12345";
    process.env.YANDEX_OCR_FOLDER_ID = "b1g-folder-id";
    __resetOcrCache();
    const p = getOcr();
    expect(p.name).toBe("yandex");
    expect(p.available).toBe(true);
    expect(p.inlineLimitBytes).toBe(1024 * 1024);
    expect(isOcrAvailable()).toBe(true);
  });

  it("treats placeholders as unconfigured", () => {
    process.env.YANDEX_OCR_API_KEY = "your-api-key-here";
    process.env.YANDEX_OCR_FOLDER_ID = "your-folder-id-here";
    __resetOcrCache();
    expect(isOcrAvailable()).toBe(false);
  });

  it("noop.recognize throws OcrError NOT_CONFIGURED", async () => {
    let caught: unknown;
    try {
      await getOcr().recognize({
        data: new Uint8Array([1, 2, 3]),
        mimeType: "application/pdf",
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(OcrError);
    expect((caught as OcrError).code).toBe("NOT_CONFIGURED");
  });

  it("yandex rejects oversized input before any network call", async () => {
    process.env.YANDEX_OCR_API_KEY = "real-key";
    process.env.YANDEX_OCR_FOLDER_ID = "real-folder";
    __resetOcrCache();
    let caught: unknown;
    try {
      await getOcr().recognize({
        data: new Uint8Array(2 * 1024 * 1024), // 2 MB
        mimeType: "application/pdf",
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(OcrError);
    expect((caught as OcrError).code).toBe("INPUT_TOO_LARGE");
  });

  it("yandex rejects unsupported MIME types", async () => {
    process.env.YANDEX_OCR_API_KEY = "real-key";
    process.env.YANDEX_OCR_FOLDER_ID = "real-folder";
    __resetOcrCache();
    let caught: unknown;
    try {
      await getOcr().recognize({
        data: new Uint8Array([1, 2, 3]),
        mimeType: "application/zip",
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(OcrError);
    expect((caught as OcrError).code).toBe("UNSUPPORTED_MIME");
  });
});
