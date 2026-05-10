import {
  StorageError,
  type SignedUrlOptions,
  type StorageProvider,
  type UploadInput,
  type UploadResult,
} from "./types";

function getToken(): string | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token || token === "your-token-here") return null;
  return token;
}

function buildKey(input: UploadInput): string {
  const folder = (input.folder ?? "documents").replace(/^\/+|\/+$/g, "");
  // sanitize fileName — strip path bits, keep extension
  const safeName = input.fileName
    .replace(/[\\/]+/g, "_")
    .replace(/[^A-Za-z0-9._\-А-Яа-яЁё]/g, "_")
    .slice(0, 80) || "file";
  // Random prefix prevents enumeration even though Blob URLs already include
  // a random suffix.
  const random = crypto.getRandomValues(new Uint8Array(8));
  const id = Array.from(random, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${folder}/${id}-${safeName}`;
}

function toBlobBody(data: UploadInput["data"]): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data);
  return Buffer.from(new Uint8Array(data));
}

export const vercelBlobProvider: StorageProvider = {
  name: "vercel-blob",

  get available() {
    return getToken() !== null;
  },

  async upload(input: UploadInput): Promise<UploadResult> {
    const token = getToken();
    if (!token) {
      throw new StorageError(
        "BLOB_READ_WRITE_TOKEN is not configured",
        "vercel-blob"
      );
    }

    const { put } = await import("@vercel/blob");
    const key = buildKey(input);

    try {
      const result = await put(key, toBlobBody(input.data), {
        access: "public",
        contentType: input.mimeType,
        token,
        // Adds a random suffix on top of our key — defense in depth against
        // enumeration if folder structure ever leaks.
        addRandomSuffix: true,
      });

      return {
        key: result.pathname,
        url: result.url,
        mimeType: input.mimeType,
      };
    } catch (e) {
      throw new StorageError(
        `Vercel Blob upload failed: ${(e as Error).message}`,
        "vercel-blob",
        e
      );
    }
  },

  async delete(key: string): Promise<void> {
    const token = getToken();
    if (!token) return; // best-effort; nothing to do without a token

    try {
      const { del } = await import("@vercel/blob");
      await del(key, { token });
    } catch (e) {
      throw new StorageError(
        `Vercel Blob delete failed: ${(e as Error).message}`,
        "vercel-blob",
        e
      );
    }
  },

  async getDownloadUrl(key: string, _opts?: SignedUrlOptions): Promise<string> {
    const token = getToken();
    if (!token) {
      throw new StorageError(
        "BLOB_READ_WRITE_TOKEN is not configured",
        "vercel-blob"
      );
    }

    // Vercel Blob with access: "public" returns a permanent unguessable URL
    // (token is part of the path). For our threat model — leak via DB dump,
    // sniffing — the route handler that returns this URL is itself
    // auth-gated, so the URL only leaves the server to the rightful user.
    try {
      const { head } = await import("@vercel/blob");
      const meta = await head(key, { token });
      return meta.url;
    } catch (e) {
      throw new StorageError(
        `Vercel Blob head failed: ${(e as Error).message}`,
        "vercel-blob",
        e
      );
    }
  },
};
