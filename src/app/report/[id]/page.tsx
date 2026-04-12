"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
import { ScoreRing } from "@/components/score-ring";
import { AnalysisCard, type RiskItem } from "@/components/analysis-card";
import {
  ArrowLeft,
  FileText,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Loader2,
  Info,
} from "lucide-react";

interface AnalysisData {
  fileName: string;
  score: number;
  summary: string;
  risks: RiskItem[];
  isDemo?: boolean;
  documentId?: string;
}

export default function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAnalysis() {
      // First try sessionStorage (just analyzed)
      const stored = sessionStorage.getItem("analysisResult");
      if (stored) {
        try {
          const data = JSON.parse(stored);
          setAnalysis(data);
          setLoading(false);
          // Clear after reading so refreshing loads from DB
          sessionStorage.removeItem("analysisResult");
          return;
        } catch {
          // Fall through to DB fetch
        }
      }

      // Try loading from DB
      if (id !== "latest") {
        try {
          const response = await fetch(`/api/documents/${id}`);
          if (response.ok) {
            const data = await response.json();
            setAnalysis(data);
            setLoading(false);
            return;
          }
        } catch {
          // Fall through to error
        }
      }

      setError("Результат анализа не найден. Загрузите документ заново.");
      setLoading(false);
    }

    loadAnalysis();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-full flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted">Загружаем отчёт...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="flex min-h-full flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-4">
            <AlertTriangle className="h-12 w-12 text-warning mx-auto mb-4" />
            <h2 className="text-lg font-bold text-foreground mb-2">
              Отчёт не найден
            </h2>
            <p className="text-muted mb-6">
              {error || "Результат анализа не найден."}
            </p>
            <Link
              href="/analyze"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              Загрузить документ
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const criticalCount = analysis.risks.filter(
    (r) => r.level === "critical"
  ).length;
  const mediumCount = analysis.risks.filter(
    (r) => r.level === "medium"
  ).length;
  const lowCount = analysis.risks.filter((r) => r.level === "low").length;

  return (
    <div className="flex min-h-full flex-col">
      <Header />

      <main className="flex-1 bg-surface/30">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Top bar */}
          <div className="mb-8 flex items-center justify-between">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              К дашборду
            </Link>
            <Link
              href="/analyze"
              className="flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
            >
              Анализировать ещё
            </Link>
          </div>

          {/* Demo banner */}
          {analysis.isDemo && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 animate-fade-in">
              <Info className="h-5 w-5 shrink-0 text-blue-500 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-800">
                  Демо-анализ
                </p>
                <p className="text-sm text-blue-700 mt-0.5">
                  Это автоматический анализ по ключевым словам. Для полноценного
                  AI-анализа добавьте ANTHROPIC_API_KEY в файл .env.local
                </p>
              </div>
            </div>
          )}

          {/* Report header */}
          <div className="animate-fade-in rounded-2xl border border-border bg-card p-6 sm:p-8">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              <ScoreRing score={analysis.score} />
              <div className="flex-1 text-center sm:text-left">
                <div className="mb-2 flex items-center justify-center gap-2 sm:justify-start">
                  <FileText className="h-5 w-5 text-muted" />
                  <h1 className="text-lg font-bold text-foreground">
                    {analysis.fileName}
                  </h1>
                </div>
                <p className="text-sm leading-relaxed text-muted">
                  {analysis.summary}
                </p>

                {/* Risk counters */}
                <div className="mt-4 flex flex-wrap justify-center gap-4 sm:justify-start">
                  <div className="flex items-center gap-1.5 text-sm">
                    <AlertTriangle className="h-4 w-4 text-danger" />
                    <span className="font-semibold text-danger">
                      {criticalCount}
                    </span>
                    <span className="text-muted">критичных</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <AlertCircle className="h-4 w-4 text-warning" />
                    <span className="font-semibold text-warning">
                      {mediumCount}
                    </span>
                    <span className="text-muted">средних</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span className="font-semibold text-success">
                      {lowCount}
                    </span>
                    <span className="text-muted">низких</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Risk cards */}
          <div className="mt-6 space-y-4">
            <h2 className="text-lg font-bold text-foreground">
              Обнаруженные риски
            </h2>
            {analysis.risks.map((risk, i) => (
              <AnalysisCard key={i} risk={risk} index={i} />
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="mt-8 rounded-2xl border border-primary/20 bg-primary-light/30 p-6 text-center">
            <p className="font-semibold text-foreground">
              Хотите проверить ещё один договор?
            </p>
            <Link
              href="/analyze"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              Загрузить новый договор
            </Link>
          </div>
        </div>
      </main>

      <Disclaimer />
    </div>
  );
}
