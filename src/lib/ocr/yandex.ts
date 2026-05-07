import {
  OcrError,
  type OcrInput,
  type OcrProvider,
  type OcrResult,
} from "./types";

const YANDEX_OCR_ENDPOINT =
  "https://ocr.api.cloud.yandex.net/ocr/v1/recognizeText";
const YANDEX_INLINE_LIMIT = 1024 * 1024; // 1 MB sync API cap

const SUPPORTED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);

function getApiKey(): string | null {
  const key = process.env.YANDEX_OCR_API_KEY;
  if (!key || key === "your-api-key-here") return null;
  return key;
}

function getFolderId(): string | null {
  const id = process.env.YANDEX_OCR_FOLDER_ID;
  if (!id || id === "your-folder-id-here") return null;
  return id;
}

interface YandexOcrSuccessBody {
  result?: {
    textAnnotation?: {
      fullText?: string;
      blocks?: unknown[];
    };
  };
}

interface YandexOcrErrorBody {
  code?: number;
  message?: string;
  details?: unknown[];
}

function toBase64(data: Uint8Array | Buffer): string {
  if (Buffer.isBuffer(data)) return data.toString("base64");
  return Buffer.from(data).toString("base64");
}

export const yandexOcrProvider: OcrProvider = {
  name: "yandex",
  inlineLimitBytes: YANDEX_INLINE_LIMIT,

  get available() {
    return getApiKey() !== null && getFolderId() !== null;
  },

  async recognize(input: OcrInput): Promise<OcrResult> {
    const apiKey = getApiKey();
    const folderId = getFolderId();
    if (!apiKey || !folderId) {
      throw new OcrError(
        "Yandex OCR is not configured (YANDEX_OCR_API_KEY / YANDEX_OCR_FOLDER_ID)",
        "yandex",
        "NOT_CONFIGURED"
      );
    }

    if (!SUPPORTED_MIME.has(input.mimeType)) {
      throw new OcrError(
        `Unsupported mime type for Yandex OCR: ${input.mimeType}`,
        "yandex",
        "UNSUPPORTED_MIME"
      );
    }

    const size =
      "byteLength" in input.data
        ? input.data.byteLength
        : (input.data as Buffer).length;
    if (size > YANDEX_INLINE_LIMIT) {
      throw new OcrError(
        `Input ${size} bytes exceeds Yandex inline limit ${YANDEX_INLINE_LIMIT}`,
        "yandex",
        "INPUT_TOO_LARGE"
      );
    }

    const body = JSON.stringify({
      mimeType: input.mimeType,
      languageCodes: input.languages ?? ["ru", "en"],
      model: "page",
      content: toBase64(input.data),
    });

    const start = Date.now();
    let response: Response;
    try {
      response = await fetch(YANDEX_OCR_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Api-Key ${apiKey}`,
          "x-folder-id": folderId,
          "x-data-logging-enabled": "false",
        },
        body,
      });
    } catch (e) {
      throw new OcrError(
        `Yandex OCR request failed: ${(e as Error).message}`,
        "yandex",
        "PROVIDER_ERROR",
        e
      );
    }

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      let detail: YandexOcrErrorBody | string;
      try {
        detail = (await response.json()) as YandexOcrErrorBody;
      } catch {
        detail = await response.text();
      }
      throw new OcrError(
        `Yandex OCR ${response.status}: ${
          typeof detail === "string"
            ? detail
            : detail.message ?? JSON.stringify(detail)
        }`,
        "yandex",
        "PROVIDER_ERROR",
        detail
      );
    }

    const json = (await response.json()) as YandexOcrSuccessBody;
    const fullText = json.result?.textAnnotation?.fullText?.trim() ?? "";
    if (!fullText) {
      throw new OcrError(
        "Yandex OCR returned empty text — поверьте качеству скана",
        "yandex",
        "EMPTY_RESULT"
      );
    }

    // Yandex returns one textAnnotation per page in `blocks`; the multi-page
    // block count gives a rough page tally for usage logging.
    const pageCount = json.result?.textAnnotation?.blocks?.length ?? 1;

    return {
      text: fullText,
      pageCount,
      latencyMs,
      provider: "yandex",
    };
  },
};
