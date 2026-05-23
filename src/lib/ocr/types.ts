export type OcrProviderName = "yandex" | "noop";

export interface OcrInput {
  /** Raw bytes of the document (PDF or image) */
  data: Uint8Array | Buffer;
  /** MIME type — drives Yandex's choice of pipeline */
  mimeType: string;
  /** ISO codes; Yandex accepts "ru", "en", "kk" etc */
  languages?: string[];
}

export interface OcrResult {
  /** Recognised plain text, joined across pages with newlines */
  text: string;
  /** Page count, when the provider exposes it (Yandex returns one block per page) */
  pageCount: number;
  /** Latency end-to-end including network */
  latencyMs: number;
  /** Provider that produced the result, for logging / billing */
  provider: OcrProviderName;
}

export interface OcrProvider {
  readonly name: OcrProviderName;
  readonly available: boolean;
  /** Maximum size in bytes the provider accepts inline. Files above must be rejected upstream. */
  readonly inlineLimitBytes: number;

  recognize(input: OcrInput): Promise<OcrResult>;
}

export class OcrError extends Error {
  constructor(
    message: string,
    public readonly provider: OcrProviderName,
    public readonly code:
      | "NOT_CONFIGURED"
      | "INPUT_TOO_LARGE"
      | "PROVIDER_ERROR"
      | "EMPTY_RESULT"
      | "UNSUPPORTED_MIME",
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "OcrError";
  }
}
