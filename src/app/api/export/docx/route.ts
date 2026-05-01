import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  convertInchesToTwip,
} from "docx";

interface ExportData {
  title: string;
  content: string;
}

const FONT = "Times New Roman";

// Section header pattern: "1. SECTION TITLE" or "10. SECTION TITLE"
const SECTION_REGEX = /^\d+\.\s+[А-ЯЁ]/;
// Sub-clause pattern: "1.1." or "10.5."
const CLAUSE_REGEX = /^\d+\.\d+\./;
// Document title at top: ALL CAPS, may have "№" placeholder
const TITLE_LIKE_REGEX = /^[А-ЯЁ\s№_]+$/;

function buildParagraph(line: string, idx: number, totalLines: number): Paragraph {
  const trimmed = line.trim();

  // Empty line
  if (!trimmed) {
    return new Paragraph({ text: "" });
  }

  // First few lines: title (centered, bold, larger)
  if (idx < 3 && TITLE_LIKE_REGEX.test(trimmed) && trimmed.length > 5) {
    return new Paragraph({
      children: [
        new TextRun({
          text: trimmed,
          bold: true,
          size: 28,
          font: FONT,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
    });
  }

  // City/date line: "г. Москва ... 5 мая 2026 года"
  if (trimmed.startsWith("г. ") && trimmed.includes("года")) {
    return new Paragraph({
      children: [
        new TextRun({ text: trimmed, size: 22, font: FONT }),
      ],
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 240 },
    });
  }

  // Section header: "1. ПРЕДМЕТ ДОГОВОРА" — bold, larger spacing above
  if (SECTION_REGEX.test(trimmed)) {
    return new Paragraph({
      children: [
        new TextRun({
          text: trimmed,
          bold: true,
          size: 24,
          font: FONT,
        }),
      ],
      alignment: AlignmentType.LEFT,
      spacing: { before: 280, after: 120 },
      heading: HeadingLevel.HEADING_2,
    });
  }

  // Clause "1.1. ..." — regular, justified
  if (CLAUSE_REGEX.test(trimmed)) {
    return new Paragraph({
      children: [new TextRun({ text: trimmed, size: 22, font: FONT })],
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 100 },
    });
  }

  // "ПОДПИСИ СТОРОН:" / "РЕКВИЗИТЫ И ПОДПИСИ СТОРОН" etc. — bold uppercase
  if (TITLE_LIKE_REGEX.test(trimmed) && trimmed.length > 8) {
    return new Paragraph({
      children: [
        new TextRun({ text: trimmed, bold: true, size: 22, font: FONT }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 280, after: 160 },
    });
  }

  // Signature lines and reqs section — keep monospace-like, leftt aligned
  if (
    line.includes("М.П.") ||
    line.includes("/") && line.includes("(подпись)") ||
    line.includes("ИНН:") ||
    line.includes("Адрес:") ||
    line.includes("Р/с:") ||
    line.includes("К/с:") ||
    line.includes("Банк:") ||
    line.includes("БИК:") ||
    line.includes("ОГРН:") ||
    line.includes("КПП:") ||
    line.includes("Паспорт:") ||
    line.includes("СНИЛС:")
  ) {
    return new Paragraph({
      children: [new TextRun({ text: line, size: 22, font: FONT })],
      alignment: AlignmentType.LEFT,
      spacing: { after: 60 },
    });
  }

  // Default: justified body text
  return new Paragraph({
    children: [new TextRun({ text: line, size: 22, font: FONT })],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 80 },
  });
}

export async function POST(request: NextRequest) {
  try {
    const data: ExportData = await request.json();

    const lines = data.content.split("\n");
    const paragraphs = lines.map((line, idx) =>
      buildParagraph(line, idx, lines.length)
    );

    const doc = new Document({
      creator: "Юрист 2.0",
      title: data.title,
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1.18),
                right: convertInchesToTwip(0.59),
              },
            },
          },
          children: paragraphs,
        },
      ],
      styles: {
        default: {
          document: {
            run: { font: FONT, size: 22 },
          },
        },
      },
    });

    const buffer = await Packer.toBuffer(doc);
    const safeName = data.title.replace(/[^a-z0-9а-я]/gi, "_").substring(0, 50);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(safeName)}.docx"`,
      },
    });
  } catch (error) {
    console.error("DOCX generation error:", error);
    return NextResponse.json(
      { error: "Ошибка при генерации DOCX" },
      { status: 500 }
    );
  }
}
