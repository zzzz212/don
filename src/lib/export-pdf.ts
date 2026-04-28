"use client";

import jsPDF from "jspdf";
import "jspdf-autotable";
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

export async function exportPDF(data: ExportData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const fontUrl = "https://cdn.jsdelivr.net/npm/@fontsource/roboto@5.0.8/files/roboto-latin-400-normal.woff";
  let fontLoaded = false;

  try {
    const resp = await fetch(fontUrl);
    const buf = await resp.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), "")
    );
    doc.addFileToVFS("Roboto-Regular.ttf", base64);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    doc.setFont("Roboto");
    fontLoaded = true;
  } catch {
    // fallback — Helvetica (no Cyrillic, but at least something)
  }

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  function checkPage(needed: number) {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  }

  function heading(text: string, size = 14) {
    checkPage(12);
    doc.setFontSize(size);
    doc.setTextColor(20, 20, 20);
    if (fontLoaded) doc.setFont("Roboto", "normal");
    doc.text(text, margin, y);
    y += size * 0.5 + 2;
  }

  function paragraph(text: string, size = 10, color: [number, number, number] = [60, 60, 60]) {
    doc.setFontSize(size);
    doc.setTextColor(...color);
    if (fontLoaded) doc.setFont("Roboto", "normal");
    const lines = doc.splitTextToSize(text, contentW);
    for (const line of lines) {
      checkPage(6);
      doc.text(line, margin, y);
      y += 5;
    }
    y += 2;
  }

  // Title
  heading("Юридический аудит договора", 16);
  y += 2;

  // Meta
  paragraph(`Документ: ${data.fileName}`, 10, [40, 40, 40]);
  paragraph(`Оценка: ${data.score}/10`, 11, [20, 20, 20]);
  if (data.contractType) paragraph(`Тип договора: ${data.contractType}`);
  if (data.parties) paragraph(`Стороны: ${data.parties}`);
  y += 2;

  // Summary
  heading("Общее заключение", 13);
  paragraph(data.summary);
  y += 2;

  // Notarization & Registration
  if (data.notarization) {
    heading("Нотариальное заверение", 12);
    paragraph(
      `${data.notarization.required ? "ТРЕБУЕТСЯ" : "Не требуется"}. ${data.notarization.reason}`
    );
  }
  if (data.registration) {
    heading("Государственная регистрация", 12);
    paragraph(
      `${data.registration.required ? "ТРЕБУЕТСЯ" : "Не требуется"}. ${data.registration.reason}`
    );
  }
  y += 2;

  // Risks
  heading("Обнаруженные риски", 14);
  y += 2;

  for (let i = 0; i < data.risks.length; i++) {
    const risk = data.risks[i];
    checkPage(40);

    const levelLabel = LEVEL_LABELS[risk.level] || risk.level;
    heading(`${i + 1}. [${levelLabel}] ${risk.clauseTitle} (${risk.clauseNumber})`, 11);

    if (risk.legalReference) {
      paragraph(`Правовое основание: ${risk.legalReference}`, 9, [80, 80, 80]);
    }

    paragraph(risk.description);

    if (risk.originalText && risk.originalText !== "—") {
      paragraph(`Текущая формулировка: «${risk.originalText}»`, 9, [160, 40, 40]);
    }

    if (risk.recommendedText && risk.recommendedText !== "—") {
      paragraph(`Рекомендуемая формулировка: ${risk.recommendedText}`, 9, [20, 100, 40]);
    }

    paragraph(`Действие: ${risk.recommendation}`, 9, [40, 40, 120]);
    y += 4;
  }

  // Missing clauses
  if (data.missingClauses && data.missingClauses.length > 0) {
    heading("Отсутствующие пункты", 13);
    for (const clause of data.missingClauses) {
      paragraph(`• ${clause}`);
    }
    y += 2;
  }

  // Checklist
  if (data.preSigningChecklist && data.preSigningChecklist.length > 0) {
    heading("Чек-лист перед подписанием", 13);
    data.preSigningChecklist.forEach((item, i) => {
      paragraph(`${i + 1}. ${item}`);
    });
    y += 2;
  }

  // Disclaimer
  checkPage(20);
  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 6;
  paragraph(
    "Данный отчёт подготовлен автоматически с использованием ИИ и носит информационный характер. Не является юридической консультацией. Рекомендуется проверка квалифицированным юристом.",
    8,
    [140, 140, 140]
  );

  const safeName = data.fileName.replace(/\.[^.]+$/, "");
  doc.save(`Аудит_${safeName}.pdf`);
}
