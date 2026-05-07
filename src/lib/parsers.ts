// eslint-disable-next-line @typescript-eslint/no-require-imports
import mammoth from "mammoth";

export interface ParseResult {
  text: string;
  pages?: number;
  /**
   * True when the file is a PDF whose embedded text layer is empty or
   * whitespace-only — typical for scanned documents. The caller may then
   * decide to run OCR (subject to plan + provider availability).
   */
  needsOcr?: boolean;
  /** MIME type of the source — useful when the caller pipes bytes to OCR. */
  mimeType?: string;
}

const MIN_TEXT_PER_PAGE = 30; // characters; below this we treat as "scanned"

function isMostlyEmpty(text: string, pages: number): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return true;
  if (pages > 0 && trimmed.length / pages < MIN_TEXT_PER_PAGE) return true;
  return false;
}

/**
 * Parse a file (PDF, DOCX, or TXT) and extract text content.
 * Returns needsOcr=true when a PDF appears to be a scan.
 */
export async function parseDocument(file: File): Promise<ParseResult> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  switch (extension) {
    case "pdf":
      return parsePDF(buffer);
    case "docx":
    case "doc":
      return parseDOCX(buffer);
    case "txt":
      return { text: buffer.toString("utf-8"), mimeType: "text/plain" };
    default:
      throw new Error(`Неподдерживаемый формат файла: .${extension}`);
  }
}

async function parsePDF(buffer: Buffer): Promise<ParseResult> {
  // Import inner module directly to avoid pdf-parse auto-run issue
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse/lib/pdf-parse") as (
    buf: Buffer
  ) => Promise<{ text: string; numpages: number }>;

  const data = await pdfParse(buffer);
  return {
    text: data.text,
    pages: data.numpages,
    needsOcr: isMostlyEmpty(data.text, data.numpages),
    mimeType: "application/pdf",
  };
}

async function parseDOCX(buffer: Buffer): Promise<ParseResult> {
  const result = await mammoth.extractRawText({ buffer });
  return {
    text: result.value,
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
}
