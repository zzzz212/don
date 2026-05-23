// Shared constants and validation for the bulk-analysis flow (/bulk).
// The bulk page queues files and posts them one-by-one to /api/analyze;
// this module is the single source of truth for what counts as an
// acceptable bulk upload, kept pure so it can be unit-tested.

/**
 * Hard cap on files per bulk run. 50 sequential analyses at ~40s each
 * would keep a tab open for over half an hour — 20 is the honest upper
 * bound for a client-driven queue.
 */
export const MAX_BULK_FILES = 20;

/** Per-file size limit — mirrors the 10 MB ceiling /api/analyze enforces. */
export const MAX_BULK_FILE_BYTES = 10 * 1024 * 1024;

/** Extensions the analyze pipeline (parsers.ts) can read. */
export const BULK_ALLOWED_EXTENSIONS = ["pdf", "docx", "doc", "txt"] as const;

/** `accept` attribute for the bulk file input. */
export const BULK_ACCEPT = ".pdf,.docx,.doc,.txt";

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/**
 * Validate one file for the bulk queue. Returns a human-readable Russian
 * error string, or null when the file is acceptable. Takes a plain
 * { name, size } so it works on both File objects and test fixtures.
 *
 * The extension check runs first: a wrong-format file is rejected for
 * the more fundamental reason even if it is also oversized.
 */
export function bulkFileError(file: {
  name: string;
  size: number;
}): string | null {
  const ext = extensionOf(file.name);
  if (!(BULK_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return "Формат не поддерживается — нужен PDF, DOCX, DOC или TXT";
  }
  if (file.size > MAX_BULK_FILE_BYTES) {
    return "Файл больше 10 МБ";
  }
  if (file.size === 0) {
    return "Файл пуст";
  }
  return null;
}
