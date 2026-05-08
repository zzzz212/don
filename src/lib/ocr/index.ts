import { noopOcrProvider } from "./noop";
import { yandexOcrProvider } from "./yandex";
import type { OcrProvider } from "./types";

export type {
  OcrInput,
  OcrProvider,
  OcrProviderName,
  OcrResult,
} from "./types";
export { OcrError } from "./types";
export {
  recognizeMultiPagePdf,
  type MultiPageResult,
} from "./multipage";
export { MAX_PAGES_PER_DOCUMENT } from "./pdf-splitter";

const PROVIDERS: OcrProvider[] = [yandexOcrProvider];

let cached: OcrProvider | null = null;

export function getOcr(): OcrProvider {
  if (cached) return cached;
  for (const p of PROVIDERS) {
    if (p.available) {
      cached = p;
      return p;
    }
  }
  cached = noopOcrProvider;
  return noopOcrProvider;
}

export function isOcrAvailable(): boolean {
  return getOcr().name !== "noop";
}

export function __resetOcrCache() {
  cached = null;
}
