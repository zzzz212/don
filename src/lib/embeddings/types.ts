// Provider-agnostic embedding interface. Same shape pattern as
// src/lib/storage, src/lib/ocr, src/lib/counterparty.

export type EmbeddingProviderName = "voyage" | "noop";

export type EmbeddingInputType = "document" | "query";

export interface EmbeddingResult {
  /** Float vector. Length === provider.dimensions. */
  vector: number[];
  /** Tokens consumed by this call (for billing / usage logging) */
  tokens: number;
  provider: EmbeddingProviderName;
  model: string;
}

export interface EmbeddingProvider {
  readonly name: EmbeddingProviderName;
  readonly available: boolean;
  /** Vector dimensionality. Must match the DB schema column. */
  readonly dimensions: number;
  /** Per-call input length cap (chars). Longer text is truncated. */
  readonly maxInputChars: number;

  /**
   * Embed a single text. `inputType` distinguishes a stored corpus item
   * ("document") from an end-user search query ("query"); some providers
   * use different sub-models for these to improve retrieval quality.
   */
  embed(text: string, inputType: EmbeddingInputType): Promise<EmbeddingResult>;

  /**
   * Embed a batch. Provider may use a more efficient bulk endpoint than
   * calling embed() N times. Returns results in input order.
   */
  embedBatch(
    texts: string[],
    inputType: EmbeddingInputType
  ): Promise<EmbeddingResult[]>;
}

export class EmbeddingError extends Error {
  constructor(
    message: string,
    public readonly provider: EmbeddingProviderName,
    public readonly code:
      | "NOT_CONFIGURED"
      | "INPUT_TOO_LARGE"
      | "PROVIDER_ERROR"
      | "EMPTY_INPUT",
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "EmbeddingError";
  }
}
