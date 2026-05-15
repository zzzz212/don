import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";

interface RiskItem {
  clauseNumber: string;
  clauseTitle: string;
  level: string;
  description: string;
  consequence?: string;
  legalReference: string;
  originalText: string;
  recommendedText: string;
  recommendation: string;
}

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
  critical: "#CC0000",
  medium: "#CC8800",
  low: "#228B22",
};

export async function POST(request: NextRequest) {
  try {
    const data: ExportData = await request.json();

    const fontsDir = path.join(process.cwd(), "src", "fonts");
    const regularFont = path.join(fontsDir, "Roboto-Regular.ttf");
    const boldFont = path.join(fontsDir, "Roboto-Bold.ttf");

    const hasRegular = fs.existsSync(regularFont);
    const hasBold = fs.existsSync(boldFont);

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      font: regularFont,
      info: {
        Title: `Аудит: ${data.fileName}`,
        Author: "ЮрИИст",
      },
    });

    if (hasBold) doc.registerFont("Bold", boldFont);
    doc.registerFont("Regular", regularFont);

    const fontRegular = "Regular";
    const fontBold = hasBold ? "Bold" : "Regular";

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    const pdfReady = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    const pageWidth = doc.page.width - 100;

    // Title
    doc.font(fontBold).fontSize(20).fillColor("#1a1a1a")
      .text("Юридический аудит договора", { align: "center" });
    doc.moveDown(0.5);

    // Separator
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y)
      .strokeColor("#e0e0e0").stroke();
    doc.moveDown(0.5);

    // Meta info
    doc.font(fontRegular).fontSize(10).fillColor("#555555");
    doc.text(`Документ: ${data.fileName}`);
    doc.font(fontBold).fontSize(12).fillColor("#1a1a1a")
      .text(`Оценка: ${data.score}/10`);
    if (data.contractType) {
      doc.font(fontRegular).fontSize(10).fillColor("#555555")
        .text(`Тип договора: ${data.contractType}`);
    }
    if (data.parties) {
      doc.font(fontRegular).fontSize(10).fillColor("#555555")
        .text(`Стороны: ${data.parties}`);
    }
    doc.moveDown(0.8);

    // Summary
    doc.font(fontBold).fontSize(14).fillColor("#1a1a1a")
      .text("Общее заключение");
    doc.moveDown(0.3);
    doc.font(fontRegular).fontSize(10).fillColor("#333333")
      .text(data.summary, { width: pageWidth });
    doc.moveDown(0.8);

    // Notarization
    if (data.notarization) {
      doc.font(fontBold).fontSize(11).fillColor("#1a1a1a")
        .text("Нотариальное заверение: ", { continued: true });
      doc.fillColor(data.notarization.required ? "#CC8800" : "#228B22")
        .text(data.notarization.required ? "ТРЕБУЕТСЯ" : "Не требуется");
      doc.font(fontRegular).fontSize(9).fillColor("#666666")
        .text(data.notarization.reason, { width: pageWidth });
      doc.moveDown(0.5);
    }

    // Registration
    if (data.registration) {
      doc.font(fontBold).fontSize(11).fillColor("#1a1a1a")
        .text("Государственная регистрация: ", { continued: true });
      doc.fillColor(data.registration.required ? "#CC8800" : "#228B22")
        .text(data.registration.required ? "ТРЕБУЕТСЯ" : "Не требуется");
      doc.font(fontRegular).fontSize(9).fillColor("#666666")
        .text(data.registration.reason, { width: pageWidth });
      doc.moveDown(0.5);
    }

    doc.moveDown(0.5);

    // Risks section
    doc.font(fontBold).fontSize(16).fillColor("#1a1a1a")
      .text("Обнаруженные риски");
    doc.moveDown(0.5);

    for (let i = 0; i < data.risks.length; i++) {
      const risk = data.risks[i];
      const levelLabel = LEVEL_LABELS[risk.level] || risk.level;
      const levelColor = LEVEL_COLORS[risk.level] || "#333333";

      if (doc.y > doc.page.height - 150) doc.addPage();

      // Risk header
      doc.font(fontBold).fontSize(11).fillColor(levelColor)
        .text(`${i + 1}. [${levelLabel}] `, { continued: true });
      doc.fillColor("#1a1a1a")
        .text(`${risk.clauseTitle} (${risk.clauseNumber})`);

      // Legal reference
      if (risk.legalReference) {
        doc.font(fontRegular).fontSize(8).fillColor("#888888")
          .text(`Правовое основание: ${risk.legalReference}`);
      }

      doc.moveDown(0.2);

      // Description
      doc.font(fontRegular).fontSize(10).fillColor("#333333")
        .text(risk.description, { width: pageWidth });

      // Consequence — what the client concretely stands to lose
      if (risk.consequence) {
        doc.moveDown(0.2);
        doc.font(fontBold).fontSize(9).fillColor("#CC8800")
          .text("Чем грозит:", { width: pageWidth });
        doc.font(fontRegular).fontSize(9).fillColor("#8A5A00")
          .text(risk.consequence, { width: pageWidth });
      }

      // Original text
      if (risk.originalText && risk.originalText !== "—" && risk.originalText !== "Пункт в договоре отсутствует") {
        doc.moveDown(0.2);
        doc.font(fontBold).fontSize(9).fillColor("#CC0000")
          .text("Текущая формулировка:", { width: pageWidth });
        doc.font(fontRegular).fontSize(9).fillColor("#880000")
          .text(`«${risk.originalText}»`, { width: pageWidth });
      }

      // Recommended text
      if (risk.recommendedText && risk.recommendedText !== "—") {
        doc.moveDown(0.2);
        doc.font(fontBold).fontSize(9).fillColor("#228B22")
          .text("Рекомендуемая формулировка:", { width: pageWidth });
        doc.font(fontRegular).fontSize(9).fillColor("#1B5E20")
          .text(risk.recommendedText, { width: pageWidth });
      }

      // Recommendation
      doc.moveDown(0.2);
      doc.font(fontBold).fontSize(9).fillColor("#1A237E")
        .text("Действие: ", { continued: true, width: pageWidth });
      doc.font(fontRegular).fillColor("#283593")
        .text(risk.recommendation, { width: pageWidth });

      doc.moveDown(0.6);

      // Separator between risks
      if (i < data.risks.length - 1) {
        doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y)
          .strokeColor("#eeeeee").stroke();
        doc.moveDown(0.4);
      }
    }

    // Missing clauses
    if (data.missingClauses && data.missingClauses.length > 0) {
      if (doc.y > doc.page.height - 120) doc.addPage();
      doc.moveDown(0.5);
      doc.font(fontBold).fontSize(14).fillColor("#1a1a1a")
        .text("Отсутствующие пункты");
      doc.moveDown(0.3);
      for (const clause of data.missingClauses) {
        doc.font(fontRegular).fontSize(10).fillColor("#333333")
          .text(`•  ${clause}`, { width: pageWidth, indent: 10 });
        doc.moveDown(0.2);
      }
    }

    // Pre-signing checklist
    if (data.preSigningChecklist && data.preSigningChecklist.length > 0) {
      if (doc.y > doc.page.height - 120) doc.addPage();
      doc.moveDown(0.5);
      doc.font(fontBold).fontSize(14).fillColor("#1a1a1a")
        .text("Чек-лист перед подписанием");
      doc.moveDown(0.3);
      data.preSigningChecklist.forEach((item, i) => {
        doc.font(fontRegular).fontSize(10).fillColor("#333333")
          .text(`${i + 1}.  ${item}`, { width: pageWidth, indent: 10 });
        doc.moveDown(0.2);
      });
    }

    // Disclaimer
    if (doc.y > doc.page.height - 80) doc.addPage();
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y)
      .strokeColor("#cccccc").stroke();
    doc.moveDown(0.5);
    doc.font(fontRegular).fontSize(7).fillColor("#999999")
      .text(
        "Данный отчёт подготовлен автоматически с использованием ИИ и носит информационный характер. Не является юридической консультацией. Рекомендуется проверка квалифицированным юристом.",
        { width: pageWidth, align: "center" }
      );

    doc.end();

    const pdfBuffer = await pdfReady;

    const safeName = data.fileName.replace(/\.[^.]+$/, "");

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(`Аудит_${safeName}`)}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { error: "Ошибка при генерации PDF" },
      { status: 500 }
    );
  }
}
