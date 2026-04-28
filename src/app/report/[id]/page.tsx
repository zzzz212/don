"use client";

import { useEffect, useState, use, useRef } from "react";
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
  Download,
  Stamp,
  Building2,
  ListChecks,
  ClipboardCheck,
  Users,
} from "lucide-react";

interface NotarizationInfo {
  required: boolean;
  reason: string;
}

interface RegistrationInfo {
  required: boolean;
  reason: string;
}

interface AnalysisData {
  fileName: string;
  score: number;
  summary: string;
  contractType?: string;
  parties?: string;
  risks: RiskItem[];
  notarization?: NotarizationInfo;
  registration?: RegistrationInfo;
  missingClauses?: string[];
  preSigningChecklist?: string[];
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
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    async function loadAnalysis() {
      const stored = sessionStorage.getItem("analysisResult");
      if (stored) {
        try {
          const data = JSON.parse(stored);
          setAnalysis(data);
          setLoading(false);
          sessionStorage.removeItem("analysisResult");
          return;
        } catch {
          // Fall through to DB fetch
        }
      }

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
          <div className="mb-8 flex items-center justify-between print:hidden">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              К дашборду
            </Link>
            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
              >
                <Download className="h-4 w-4" />
                Скачать PDF
              </button>
              <Link
                href="/analyze"
                className="flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
              >
                Анализировать ещё
              </Link>
            </div>
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
                  AI-анализа добавьте API-ключ в .env
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

                {/* Contract type + parties */}
                {analysis.contractType && (
                  <div className="mb-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-primary-light px-2.5 py-1 text-xs font-semibold text-primary-dark">
                      <FileText className="h-3 w-3" />
                      {analysis.contractType}
                    </span>
                    {analysis.parties && (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-surface px-2.5 py-1 text-xs font-medium text-muted">
                        <Users className="h-3 w-3" />
                        {analysis.parties}
                      </span>
                    )}
                  </div>
                )}

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

          {/* Notarization & Registration */}
          {(analysis.notarization || analysis.registration) && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {analysis.notarization && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                        analysis.notarization.required
                          ? "bg-amber-50 text-amber-600"
                          : "bg-green-50 text-green-600"
                      }`}
                    >
                      <Stamp className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted">Нотариус</p>
                      <p className="font-semibold text-foreground">
                        {analysis.notarization.required
                          ? "Требуется"
                          : "Не требуется"}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-muted">
                    {analysis.notarization.reason}
                  </p>
                </div>
              )}

              {analysis.registration && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                        analysis.registration.required
                          ? "bg-amber-50 text-amber-600"
                          : "bg-green-50 text-green-600"
                      }`}
                    >
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted">Госрегистрация</p>
                      <p className="font-semibold text-foreground">
                        {analysis.registration.required
                          ? "Требуется"
                          : "Не требуется"}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-muted">
                    {analysis.registration.reason}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Risk cards */}
          <div className="mt-6 space-y-4">
            <h2 className="text-lg font-bold text-foreground">
              Обнаруженные риски
            </h2>
            {analysis.risks.map((risk, i) => (
              <AnalysisCard key={i} risk={risk} index={i} />
            ))}
          </div>

          {/* Missing clauses */}
          {analysis.missingClauses && analysis.missingClauses.length > 0 && (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/50 p-5">
              <div className="mb-3 flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-amber-600" />
                <h2 className="text-lg font-bold text-foreground">
                  Что добавить в договор
                </h2>
              </div>
              <p className="mb-3 text-sm text-muted">
                Эти пункты отсутствуют, но критически важны для защиты ваших интересов:
              </p>
              <ul className="space-y-2">
                {analysis.missingClauses.map((clause, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-foreground"
                  >
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span>{clause}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pre-signing checklist */}
          {analysis.preSigningChecklist &&
            analysis.preSigningChecklist.length > 0 && (
              <div className="mt-6 rounded-xl border border-primary/20 bg-primary-light/20 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-bold text-foreground">
                    Чек-лист перед подписанием
                  </h2>
                </div>
                <p className="mb-3 text-sm text-muted">
                  Сделайте это до того, как поставите подпись:
                </p>
                <ul className="space-y-2">
                  {analysis.preSigningChecklist.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-foreground"
                    >
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-primary/30 bg-white text-xs font-bold text-primary">
                        {i + 1}
                      </div>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {/* Bottom CTA */}
          <div className="mt-8 rounded-2xl border border-primary/20 bg-primary-light/30 p-6 text-center print:hidden">
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
