import { OcrError, type OcrProvider } from "./types";

export const noopOcrProvider: OcrProvider = {
  name: "noop",
  available: false,
  inlineLimitBytes: 0,

  async recognize() {
    throw new OcrError(
      "No OCR provider configured (set YANDEX_OCR_API_KEY + YANDEX_OCR_FOLDER_ID)",
      "noop",
      "NOT_CONFIGURED"
    );
  },
};
