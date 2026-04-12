// eslint-disable-next-line @typescript-eslint/no-require-imports
import mammoth from "mammoth";

export interface ParseResult {
  text: string;
  pages?: number;
}

/**
 * Parse a file (PDF, DOCX, or TXT) and extract text content.
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
      return { text: buffer.toString("utf-8") };
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
  };
}

async function parseDOCX(buffer: Buffer): Promise<ParseResult> {
  const result = await mammoth.extractRawText({ buffer });
  return {
    text: result.value,
  };
}
