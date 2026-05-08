import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  splitPdfPages,
  getPdfPageCount,
  MAX_PAGES_PER_DOCUMENT,
} from "../pdf-splitter";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([595, 842]);
    page.drawText(`Page ${i + 1} of ${pages}`, {
      x: 50,
      y: 800,
      size: 24,
      font,
      color: rgb(0, 0, 0),
    });
  }
  return await doc.save();
}

describe("getPdfPageCount", () => {
  it("returns 1 for a single-page PDF", async () => {
    const bytes = await makePdf(1);
    expect(await getPdfPageCount(bytes)).toBe(1);
  });

  it("returns the actual page count for multi-page PDFs", async () => {
    const bytes = await makePdf(7);
    expect(await getPdfPageCount(bytes)).toBe(7);
  });
});

describe("splitPdfPages", () => {
  it("returns one buffer per page", async () => {
    const bytes = await makePdf(3);
    const pages = await splitPdfPages(bytes);
    expect(pages).toHaveLength(3);
  });

  it("zero-indexes pages in order", async () => {
    const bytes = await makePdf(5);
    const pages = await splitPdfPages(bytes);
    expect(pages.map((p) => p.pageIndex)).toEqual([0, 1, 2, 3, 4]);
  });

  it("each per-page PDF is a valid loadable PDF", async () => {
    const bytes = await makePdf(4);
    const pages = await splitPdfPages(bytes);
    for (const page of pages) {
      const reloaded = await PDFDocument.load(page.data);
      expect(reloaded.getPageCount()).toBe(1);
    }
  });

  it("per-page PDFs are smaller than the original", async () => {
    const bytes = await makePdf(10);
    const pages = await splitPdfPages(bytes);
    for (const page of pages) {
      expect(page.data.byteLength).toBeLessThan(bytes.byteLength);
    }
  });

  it("rejects malformed input with a clear error", async () => {
    await expect(splitPdfPages(new Uint8Array([0, 1, 2, 3]))).rejects.toThrow();
  });

  it("MAX_PAGES_PER_DOCUMENT is set to a sensible value", () => {
    expect(MAX_PAGES_PER_DOCUMENT).toBeGreaterThanOrEqual(20);
    expect(MAX_PAGES_PER_DOCUMENT).toBeLessThanOrEqual(50);
  });
});
