import { PDFParse } from "pdf-parse";
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
  const pdf = new PDFParse({ data: buffer });
  const textResult = await pdf.getText();
  await pdf.destroy();
  return {
    text: textResult.text,
    pages: textResult.total,
  };
}

async function parseDOCX(buffer: Buffer): Promise<ParseResult> {
  const result = await mammoth.extractRawText({ buffer });
  return {
    text: result.value,
  };
}
