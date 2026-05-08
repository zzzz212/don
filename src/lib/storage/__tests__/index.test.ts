import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getStorage,
  isStorageAvailable,
  __resetStorageCache,
} from "../index";
import { StorageErrorClass } from "../index";

describe("getStorage factory", () => {
  const originalToken = process.env.BLOB_READ_WRITE_TOKEN;

  beforeEach(() => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    __resetStorageCache();
  });

  afterEach(() => {
    if (originalToken !== undefined) {
      process.env.BLOB_READ_WRITE_TOKEN = originalToken;
    } else {
      delete process.env.BLOB_READ_WRITE_TOKEN;
    }
    __resetStorageCache();
  });

  it("returns the noop provider when no token is configured", () => {
    const provider = getStorage();
    expect(provider.name).toBe("noop");
    expect(provider.available).toBe(false);
    expect(isStorageAvailable()).toBe(false);
  });

  it("returns the vercel-blob provider when a real-looking token is set", () => {
    process.env.BLOB_READ_WRITE_TOKEN =
      "vercel_blob_rw_FAKE_TOKEN_123456789";
    __resetStorageCache();
    const provider = getStorage();
    expect(provider.name).toBe("vercel-blob");
    expect(provider.available).toBe(true);
    expect(isStorageAvailable()).toBe(true);
  });

  it("treats the placeholder 'your-token-here' as unconfigured", () => {
    process.env.BLOB_READ_WRITE_TOKEN = "your-token-here";
    __resetStorageCache();
    expect(isStorageAvailable()).toBe(false);
  });

  it("noop.upload throws StorageError with NOT_CONFIGURED hint", async () => {
    const provider = getStorage();
    expect(provider.name).toBe("noop");
    let caught: unknown;
    try {
      await provider.upload({
        fileName: "x.txt",
        mimeType: "text/plain",
        data: new Uint8Array([1, 2, 3]),
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(StorageErrorClass);
    expect((caught as Error).message).toMatch(/BLOB_READ_WRITE_TOKEN/);
  });

  it("noop.delete is a no-op (does not throw)", async () => {
    await expect(getStorage().delete("any-key")).resolves.toBeUndefined();
  });

  it("noop.getDownloadUrl throws", async () => {
    await expect(
      getStorage().getDownloadUrl("any-key")
    ).rejects.toBeInstanceOf(StorageErrorClass);
  });

  it("memoises the provider until reset", () => {
    const a = getStorage();
    const b = getStorage();
    expect(a).toBe(b);
    __resetStorageCache();
    const c = getStorage();
    // Different reference is fine — what matters is it picks fresh env
    expect(c.name).toBe("noop");
  });
});
