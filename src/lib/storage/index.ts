import { noopProvider } from "./noop";
import type { StorageProvider } from "./types";
import { vercelBlobProvider } from "./vercel-blob";

export type {
  SignedUrlOptions,
  StorageError,
  StorageProvider,
  StorageProviderName,
  UploadInput,
  UploadResult,
} from "./types";

export { StorageError as StorageErrorClass } from "./types";

// Provider priority — first available wins. Currently only Vercel Blob is
// implemented; Yandex Object Storage is intended to slot in for 152-ФЗ
// compliance when the b2b tier needs it.
const PROVIDERS: StorageProvider[] = [vercelBlobProvider];

let cached: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (cached) return cached;
  for (const p of PROVIDERS) {
    if (p.available) {
      cached = p;
      return p;
    }
  }
  cached = noopProvider;
  return noopProvider;
}

export function isStorageAvailable(): boolean {
  return getStorage().name !== "noop";
}

// Test-only — reset the memoised provider after env mutations.
export function __resetStorageCache() {
  cached = null;
}
