// Splits a multi-page PDF into one Buffer per page using pdf-lib. Pure JS,
// no native deps — works on Vercel serverless without extra build config.

export const MAX_PAGES_PER_DOCUMENT = 30;

export interface SplitPage {
  pageIndex: number; // zero-based
  data: Uint8Array;
}

export interface PdfPageInfo {
  pageCount: number;
}

export async function getPdfPageCount(pdfBytes: Uint8Array): Promise<number> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
    throwOnInvalidObject: false,
    updateMetadata: false,
  });
  return doc.getPageCount();
}

export async function splitPdfPages(
  pdfBytes: Uint8Array
): Promise<SplitPage[]> {
  const { PDFDocument } = await import("pdf-lib");

  const source = await PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
    throwOnInvalidObject: false,
    updateMetadata: false,
  });

  const pageCount = source.getPageCount();
  if (pageCount === 0) return [];

  const out: SplitPage[] = [];
  for (let i = 0; i < pageCount; i++) {
    const fresh = await PDFDocument.create();
    const [copied] = await fresh.copyPages(source, [i]);
    fresh.addPage(copied);

    // Skip metadata to keep page PDFs as small as possible.
    const data = await fresh.save({
      addDefaultPage: false,
      objectsPerTick: 50,
    });
    out.push({ pageIndex: i, data });
  }
  return out;
}
