"use client";

import type { RiskItem } from "@/components/analysis-card";

interface ExportData {
  fileName: string;
  score: number;
  summary: string;
  contractType?: string;
  parties?: string;
  balance?: { favor: string; comment: string };
  risks: RiskItem[];
  notarization?: { required: boolean; reason: string };
  registration?: { required: boolean; reason: string };
  missingClauses?: string[];
  preSigningChecklist?: string[];
}

export async function exportPDF(data: ExportData) {
  const response = await fetch("/api/export/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("PDF generation failed");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = data.fileName.replace(/\.[^.]+$/, "");
  a.download = `Аудит_${safeName}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
