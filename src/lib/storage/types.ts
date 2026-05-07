export type StorageProviderName = "vercel-blob" | "noop";

export interface UploadInput {
  /** Original file name from user (used for Content-Disposition) */
  fileName: string;
  /** Detected MIME type */
  mimeType: string;
  /** File contents */
  data: Uint8Array | ArrayBuffer | Buffer;
  /** Logical folder, e.g. "documents" or "documents/<userId>" */
  folder?: string;
}

export interface UploadResult {
  /** Internal key — stable, used for delete and signed-url retrieval */
  key: string;
  /** Storage URL — may be public for Vercel Blob; consumers MUST gate access in their own routes */
  url: string;
  /** Detected MIME type that was stored */
  mimeType: string;
}

export interface SignedUrlOptions {
  /** Lifetime of the signed URL in seconds (advisory; not all providers honour) */
  ttlSeconds?: number;
  /** Suggested filename for download */
  downloadFileName?: string;
}

export interface StorageProvider {
  readonly name: StorageProviderName;
  readonly available: boolean;

  upload(input: UploadInput): Promise<UploadResult>;
  delete(key: string): Promise<void>;
  /** Returns a URL the browser can use to download. May be the same as upload().url. */
  getDownloadUrl(key: string, opts?: SignedUrlOptions): Promise<string>;
}

export class StorageError extends Error {
  constructor(
    message: string,
    public readonly provider: StorageProviderName,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "StorageError";
  }
}
