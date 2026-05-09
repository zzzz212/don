import { noopEmbeddingProvider } from "./noop";
import { voyageEmbeddingProvider } from "./voyage";
import type { EmbeddingProvider } from "./types";

export type {
  EmbeddingInputType,
  EmbeddingProvider,
  EmbeddingProviderName,
  EmbeddingResult,
} from "./types";
export { EmbeddingError } from "./types";

const PROVIDERS: EmbeddingProvider[] = [voyageEmbeddingProvider];

let cached: EmbeddingProvider | null = null;

export function getEmbedder(): EmbeddingProvider {
  if (cached) return cached;
  for (const p of PROVIDERS) {
    if (p.available) {
      cached = p;
      return p;
    }
  }
  cached = noopEmbeddingProvider;
  return noopEmbeddingProvider;
}

export function isEmbeddingAvailable(): boolean {
  return getEmbedder().name !== "noop";
}

export function __resetEmbedderCache() {
  cached = null;
}
