// Pre-analyze document preparation: parse file → detect OCR need →
// optionally run OCR → length-check the resulting text. Extracted from
// the old /api/analyze/route.ts so /api/analyze/start can run these
// fast (<15s) steps synchronously inside the request handler, write
// a PENDING Analysis row, and hand off to the background worker.
//
// Pure data transform — no auth, no quota check, no DB. Caller does
// auth+quota; this module only returns the prepared text or throws a
// typed error the caller can map to an HTTP status.

import { parseDocument } from "@/lib/parsers";
import { isOversizedDocument, HARD_DOC_LIMIT } from "@/lib/ai/chunking";
import {
  getOcr,
  isOcrAvailable,
  OcrError,
  recognizeMultiPagePdf,
} from "@/lib/ocr";
import { logOcrUsage } from "@/lib/ai/usage";

export type PrepareErrorCode =
  | "EMPTY_DOCUMENT"
  | "DOCUMENT_TOO_LARGE"
  | "DOCUMENT_TOO_LARGE_FOR_OCR"
  | "OCR_NOT_AVAILABLE"
  | "OCR_EMPTY_RESULT"
  | "OCR_PROVIDER_ERROR"
  | "OCR_INPUT_TOO_LARGE"
  | "PARSE_FAILED";

export class PrepareError extends Error {
  constructor(
    message: string,
    public readonly code: PrepareErrorCode,
    public readonly extra?: Record<string, unknown>
  ) {
    super(message);
    this.name = "PrepareError";
  }
}

export interface PrepareResult {
  contractText: string;
  usedOcr: boolean;
  /** mimeType after parsing — may differ from original if parser disambiguated */
  mimeType: string;
  fileBytes: Uint8Array;
}

/**
 * Parse a file, run OCR if needed (and allowed), and return ready-to-analyze
 * text. Throws PrepareError on any failure the caller should map to HTTP.
 *
 * @param file The uploaded File from FormData
 * @param ocrAllowed Whether the current user's plan permits OCR (caller
 *                   checked plan/quota beforehand)
 * @param userId    For OCR usage logging — pass null if anonymous
 * @param orgId     For OCR usage logging — pass null if anonymous
 */
export async function prepareDocument(
  file: File,
  ocrAllowed: boolean,
  userId: string | null,
  orgId: string | null
): Promise<PrepareResult> {
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const originalMimeType = file.type || "application/octet-stream";

  // 1. Parse the document
  let contractText = "";
  let needsOcr = false;
  let mimeType = originalMimeType;
  try {
    const parsed = await parseDocument(
      new File([fileBytes], file.name, { type: originalMimeType })
    );
    contractText = parsed.text;
    needsOcr = parsed.needsOcr ?? false;
    if (parsed.mimeType) mimeType = parsed.mimeType;
  } catch {
    throw new PrepareError(
      "Не удалось прочитать файл. Убедитесь, что формат поддерживается (PDF, DOCX, TXT).",
      "PARSE_FAILED"
    );
  }

  // 2. OCR path
  let usedOcr = false;
  if (needsOcr) {
    if (!isOcrAvailable()) {
      throw new PrepareError(
        "Документ выглядит как скан (текстовый слой пуст). Распознавание сканов не настроено в этом окружении.",
        "OCR_NOT_AVAILABLE"
      );
    }
    if (!ocrAllowed) {
      throw new PrepareError(
        "Распознавание сканов доступно на тарифах «Про» и «Бизнес». Перейдите на платный план.",
        "OCR_NOT_AVAILABLE"
      );
    }

    const ocr = getOcr();
    const isPdf = mimeType === "application/pdf";
    const fitsInline = file.size <= ocr.inlineLimitBytes;

    try {
      if (fitsInline) {
        const ocrResult = await ocr.recognize({
          data: fileBytes,
          mimeType,
          languages: ["ru", "en"],
        });
        contractText = ocrResult.text;
        usedOcr = true;
        await logOcrUsage(userId, orgId, ocrResult, contractText.length);
      } else if (isPdf) {
        const ocrResult = await recognizeMultiPagePdf(fileBytes);
        contractText = ocrResult.text;
        usedOcr = true;
        await logOcrUsage(userId, orgId, ocrResult, contractText.length);
        if (ocrResult.failedPages > 0) {
          console.warn(
            `[prepare] OCR completed with ${ocrResult.failedPages}/${ocrResult.pageCount} failed pages`
          );
        }
      } else {
        throw new PrepareError(
          `Размер изображения (${(file.size / 1024 / 1024).toFixed(2)} МБ) превышает лимит OCR (${(ocr.inlineLimitBytes / 1024 / 1024).toFixed(2)} МБ на изображение). Уменьшите разрешение или сожмите файл.`,
          "DOCUMENT_TOO_LARGE_FOR_OCR",
          { sizeBytes: file.size, limitBytes: ocr.inlineLimitBytes }
        );
      }
    } catch (ocrError) {
      if (ocrError instanceof PrepareError) throw ocrError;
      const code =
        ocrError instanceof OcrError ? ocrError.code : "PROVIDER_ERROR";
      console.error("[prepare] OCR failed:", ocrError);
      if (code === "EMPTY_RESULT") {
        throw new PrepareError(
          "Не удалось распознать текст. Возможно, скан слишком низкого качества — попробуйте другую копию.",
          "OCR_EMPTY_RESULT"
        );
      }
      if (code === "INPUT_TOO_LARGE") {
        throw new PrepareError(
          ocrError instanceof OcrError
            ? ocrError.message
            : "Изображение слишком большое для OCR",
          "OCR_INPUT_TOO_LARGE"
        );
      }
      throw new PrepareError(
        "Сервис распознавания временно недоступен. Попробуйте позже.",
        "OCR_PROVIDER_ERROR"
      );
    }
  } else if (!contractText.trim()) {
    throw new PrepareError(
      "Документ пуст или не содержит текста.",
      "EMPTY_DOCUMENT"
    );
  }

  // 3. Length check
  if (isOversizedDocument(contractText)) {
    throw new PrepareError(
      `Документ слишком большой для автоматического анализа (${contractText.length.toLocaleString("ru-RU")} символов, лимит ${HARD_DOC_LIMIT.toLocaleString("ru-RU")}). Разбейте его на части и проанализируйте по разделам.`,
      "DOCUMENT_TOO_LARGE",
      { textLength: contractText.length, limit: HARD_DOC_LIMIT }
    );
  }

  return { contractText, usedOcr, mimeType, fileBytes };
}
