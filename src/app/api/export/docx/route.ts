import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  convertInchesToTwip,
} from "docx";

interface ExportData {
  title: string;
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const data: ExportData = await request.json();

    const lines = data.content.split("\n");
    const paragraphs = lines.map(
      (line) =>
        new Paragraph({
          text: line || "",
          style: "Normal",
        })
    );

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1),
                right: convertInchesToTwip(1),
              },
            },
          },
          children: [
            new Paragraph({
              text: data.title,
              heading: "Heading1",
              thematicBreak: false,
              alignment: AlignmentType.CENTER,
              spacing: {
                after: 400,
              },
            }),
            ...paragraphs,
            new Paragraph({
              text: "",
              spacing: { line: 240, lineRule: "auto" },
            }),
            new Paragraph({
              text: "Документ создан с использованием ИИ. Проверьте содержание перед использованием.",
              style: "Normal",
              alignment: AlignmentType.CENTER,
              spacing: {
                before: 200,
              },
            }),
          ],
        },
      ],
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
