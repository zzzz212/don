// Orchestrates OCR of a multi-page PDF: split → recognise per page → merge.
// Used when the source PDF exceeds the OCR provider's inline size limit.

import { getOcr, isOcrAvailable } from "./index";
import { splitPdfPages, MAX_PAGES_PER_DOCUMENT } from "./pdf-splitter";
import { OcrError, type OcrResult } from "./types";

const PAGE_CONCURRENCY = 4;

export interface MultiPageResult extends OcrResult {
  successfulPages: number;
  failedPages: number;
}

export async function recognizeMultiPagePdf(
  pdfBytes: Uint8Array
): Promise<MultiPageResult> {
  if (!isOcrAvailable()) {
    throw new OcrError(
      "No OCR provider configured",
      "noop",
      "NOT_CONFIGURED"
    );
  }

  const provider = getOcr();
  const start = Date.now();

  const pages = await splitPdfPages(pdfBytes);
  if (pages.length === 0) {
    throw new OcrError(
      "PDF не содержит страниц",
      provider.name,
      "EMPTY_RESULT"
    );
  }

  if (pages.length > MAX_PAGES_PER_DOCUMENT) {
    throw new OcrError(
      `Документ содержит ${pages.length} страниц — превышен лимит ${MAX_PAGES_PER_DOCUMENT} страниц на запрос. Разделите документ на части.`,
      provider.name,
      "INPUT_TOO_LARGE"
    );
  }

  // Pre-validate: any page individually exceeding the inline limit cannot be
  // recognised by the sync API at all. Bail out early with a clear message.
  for (const page of pages) {
    if (page.data.byteLength > provider.inlineLimitBytes) {
      throw new OcrError(
        `Страница ${page.pageIndex + 1} весит ${(page.data.byteLength / 1024 / 1024).toFixed(2)} МБ, что превышает лимит OCR (${(provider.inlineLimitBytes / 1024 / 1024).toFixed(2)} МБ на страницу). Сжмите PDF перед загрузкой.`,
        provider.name,
        "INPUT_TOO_LARGE"
      );
    }
  }

  // Process pages in parallel batches to bound latency without blowing
  // through provider rate limits. allSettled guarantees one bad page does
  // not abort the whole document.
  const pageTexts: (string | null)[] = new Array(pages.length).fill(null);
  let failedPages = 0;
  let lastError: Error | null = null;

  for (let i = 0; i < pages.length; i += PAGE_CONCURRENCY) {
    const batch = pages.slice(i, i + PAGE_CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map((page) =>
        provider.recognize({
          data: page.data,
          mimeType: "application/pdf",
          languages: ["ru", "en"],
        })
      )
    );

    for (let j = 0; j < settled.length; j++) {
      const result = settled[j];
      const pageIndex = batch[j].pageIndex;
      if (result.status === "fulfilled") {
        pageTexts[pageIndex] = result.value.text;
      } else {
        failedPages++;
        lastError = result.reason;
        console.error(
          `[ocr.multipage] page ${pageIndex + 1} failed:`,
          (result.reason as Error)?.message
        );
      }
    }
  }

  const successfulPages = pages.length - failedPages;
  if (successfulPages === 0) {
    throw new OcrError(
      `Не удалось распознать ни одну страницу. Последняя ошибка: ${
        (lastError as Error)?.message ?? "unknown"
      }`,
      provider.name,
      "PROVIDER_ERROR",
      lastError
    );
  }

  // Concatenate with explicit page markers so downstream chunking has clear
  // section boundaries on top of the contract's own structure.
  const merged = pageTexts
    .map((text, i) => {
      if (text === null) return `\n\n[Страница ${i + 1}: не распознана]\n`;
      return `\n\n--- Страница ${i + 1} ---\n\n${text.trim()}`;
    })
    .join("")
    .trim();

  if (!merged || merged.length < 10) {
    throw new OcrError(
      "Распознан пустой текст. Возможно, скан слишком низкого качества.",
      provider.name,
      "EMPTY_RESULT"
    );
  }

  return {
    text: merged,
    pageCount: pages.length,
    latencyMs: Date.now() - start,
    provider: provider.name,
    successfulPages,
    failedPages,
  };
}
