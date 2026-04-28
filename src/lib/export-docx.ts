"use client";

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";
import { saveAs } from "file-saver";
import type { RiskItem } from "@/components/analysis-card";

interface ExportData {
  fileName: string;
  score: number;
  summary: string;
  contractType?: string;
  parties?: string;
  risks: RiskItem[];
  notarization?: { required: boolean; reason: string };
  registration?: { required: boolean; reason: string };
  missingClauses?: string[];
  preSigningChecklist?: string[];
}

const LEVEL_LABELS: Record<string, string> = {
  critical: "КРИТИЧНЫЙ",
  medium: "СРЕДНИЙ",
  low: "НИЗКИЙ",
};

const LEVEL_COLORS: Record<string, string> = {
  critical: "CC0000",
  medium: "CC8800",
  low: "228B22",
};

function emptyLine() {
  return new Paragraph({ text: "" });
}

export async function exportDOCX(data: ExportData) {
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Юридический аудит договора",
          bold: true,
          size: 32,
          font: "Arial",
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );

  // Meta info table
  const metaRows: [string, string][] = [
    ["Документ", data.fileName],
    ["Оценка", `${data.score}/10`],
  ];
  if (data.contractType) metaRows.push(["Тип договора", data.contractType]);
  if (data.parties) metaRows.push(["Стороны", data.parties]);

  children.push(
    new Table({
      rows: metaRows.map(
        ([label, value]) =>
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: label, bold: true, size: 20, font: "Arial" }),
                    ],
                  }),
                ],
                width: { size: 25, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: value, size: 20, font: "Arial" }),
                    ],
                  }),
                ],
                width: { size: 75, type: WidthType.PERCENTAGE },
              }),
            ],
          })
      ),
      width: { size: 100, type: WidthType.PERCENTAGE },
    }) as unknown as Paragraph
  );

  children.push(emptyLine());

  // Summary
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Общее заключение", bold: true, size: 26, font: "Arial" }),
      ],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 },
    })
  );
  children.push(
    new Paragraph({
      children: [new TextRun({ text: data.summary, size: 22, font: "Arial" })],
      spacing: { after: 200 },
    })
  );

  // Notarization
  if (data.notarization) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Нотариальное заверение: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({
            text: data.notarization.required ? "ТРЕБУЕТСЯ" : "Не требуется",
            bold: true,
            size: 22,
            font: "Arial",
            color: data.notarization.required ? "CC8800" : "228B22",
          }),
        ],
        spacing: { after: 60 },
      })
    );
    children.push(
      new Paragraph({
        children: [new TextRun({ text: data.notarization.reason, size: 20, font: "Arial", italics: true })],
        spacing: { after: 200 },
      })
    );
  }

  // Registration
  if (data.registration) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Государственная регистрация: ", bold: true, size: 22, font: "Arial" }),
          new TextRun({
            text: data.registration.required ? "ТРЕБУЕТСЯ" : "Не требуется",
            bold: true,
            size: 22,
            font: "Arial",
            color: data.registration.required ? "CC8800" : "228B22",
          }),
        ],
        spacing: { after: 60 },
      })
    );
    children.push(
      new Paragraph({
        children: [new TextRun({ text: data.registration.reason, size: 20, font: "Arial", italics: true })],
        spacing: { after: 200 },
      })
    );
  }

  // Risks
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Обнаруженные риски", bold: true, size: 28, font: "Arial" }),
      ],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 150 },
    })
  );

  data.risks.forEach((risk, i) => {
    const levelColor = LEVEL_COLORS[risk.level] || "333333";
    const levelLabel = LEVEL_LABELS[risk.level] || risk.level;

    // Risk header
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${i + 1}. `, bold: true, size: 22, font: "Arial" }),
          new TextRun({ text: `[${levelLabel}] `, bold: true, size: 22, font: "Arial", color: levelColor }),
          new TextRun({ text: `${risk.clauseTitle} (${risk.clauseNumber})`, bold: true, size: 22, font: "Arial" }),
        ],
        spacing: { before: 200, after: 60 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        },
      })
    );

    // Legal reference
    if (risk.legalReference) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Правовое основание: ", bold: true, size: 18, font: "Arial", color: "555555" }),
            new TextRun({ text: risk.legalReference, size: 18, font: "Arial", color: "555555" }),
          ],
          spacing: { after: 60 },
        })
      );
    }

    // Description
    children.push(
      new Paragraph({
        children: [new TextRun({ text: risk.description, size: 20, font: "Arial" })],
        spacing: { after: 100 },
      })
    );

    // Original text
    if (risk.originalText && risk.originalText !== "—") {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Текущая формулировка: ", bold: true, size: 20, font: "Arial", color: "CC0000" }),
            new TextRun({ text: `«${risk.originalText}»`, size: 20, font: "Arial", italics: true, color: "880000" }),
          ],
          spacing: { after: 60 },
        })
      );
    }

    // Recommended text
    if (risk.recommendedText && risk.recommendedText !== "—") {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Рекомендуемая формулировка: ", bold: true, size: 20, font: "Arial", color: "228B22" }),
            new TextRun({ text: risk.recommendedText, size: 20, font: "Arial", color: "1B5E20" }),
          ],
          spacing: { after: 60 },
        })
      );
    }

    // Recommendation
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Действие: ", bold: true, size: 20, font: "Arial", color: "1A237E" }),
          new TextRun({ text: risk.recommendation, size: 20, font: "Arial", color: "283593" }),
        ],
        spacing: { after: 150 },
      })
    );
  });

  // Missing clauses
  if (data.missingClauses && data.missingClauses.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Отсутствующие пункты", bold: true, size: 26, font: "Arial" }),
        ],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
      })
    );
    for (const clause of data.missingClauses) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `• ${clause}`, size: 20, font: "Arial" })],
          spacing: { after: 60 },
        })
      );
    }
  }

  // Checklist
  if (data.preSigningChecklist && data.preSigningChecklist.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Чек-лист перед подписанием", bold: true, size: 26, font: "Arial" }),
        ],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
      })
    );
    data.preSigningChecklist.forEach((item, i) => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `${i + 1}. ${item}`, size: 20, font: "Arial" })],
          spacing: { after: 60 },
        })
      );
    });
  }

  // Disclaimer
  children.push(emptyLine());
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Данный отчёт подготовлен автоматически с использованием ИИ и носит информационный характер. Не является юридической консультацией. Рекомендуется проверка квалифицированным юристом.",
          size: 16,
          font: "Arial",
          color: "999999",
          italics: true,
        }),
      ],
      spacing: { before: 400 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      },
    })
  );

  const docFile = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(docFile);
  const safeName = data.fileName.replace(/\.[^.]+$/, "");
  saveAs(blob, `Аудит_${safeName}.docx`);
}
