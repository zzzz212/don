import { EmbeddingError, type EmbeddingProvider } from "./types";

export const noopEmbeddingProvider: EmbeddingProvider = {
  name: "noop",
  available: false,
  dimensions: 0,
  maxInputChars: 0,

  async embed() {
    throw new EmbeddingError(
      "No embedding provider configured (set VOYAGE_API_KEY)",
      "noop",
      "NOT_CONFIGURED"
    );
  },

  async embedBatch() {
    throw new EmbeddingError(
      "No embedding provider configured (set VOYAGE_API_KEY)",
      "noop",
      "NOT_CONFIGURED"
    );
  },
};
