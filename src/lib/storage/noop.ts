import {
  StorageError,
  type StorageProvider,
  type UploadInput,
  type UploadResult,
} from "./types";

// No-op provider: used when no storage is configured. Upload always
// throws — call sites are expected to catch and continue without a blob.

export const noopProvider: StorageProvider = {
  name: "noop",
  available: false,

  async upload(_input: UploadInput): Promise<UploadResult> {
    throw new StorageError(
      "No storage provider configured (set BLOB_READ_WRITE_TOKEN)",
      "noop"
    );
  },

  async delete(_key: string): Promise<void> {
    // nothing to do
  },

  async getDownloadUrl(_key: string): Promise<string> {
    throw new StorageError(
      "No storage provider configured (set BLOB_READ_WRITE_TOKEN)",
      "noop"
    );
  },
};
