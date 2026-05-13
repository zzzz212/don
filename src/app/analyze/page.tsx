"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
import { UploadZone } from "@/components/upload-zone";
import {
  FileSearch,
  Loader2,
  CheckCircle,
  Scale,
  AlertTriangle,
  Crown,
  ExternalLink,
  LogIn,
} from "lucide-react";

interface AnalyzeError {
  message: string;
  code?: string;
  /** When code is QUOTA_EXCEEDED or OCR_NOT_AVAILABLE_ON_FREE */
  upgradeNeeded?: boolean;
  /** When code is OCR_REQUIRES_AUTH */
  authNeeded?: boolean;
  /** When code is DOCUMENT_TOO_LARGE_FOR_OCR — give compress link */
  compressHint?: boolean;
}

const stages = [
  "Извлекаем текст из документа...",
  "Анализируем структуру договора...",
  "Проверяем соответствие законодательству РФ...",
  "Оцениваем юридические риски...",
  "Формируем рекомендации...",
  "Готовим отчёт...",
];

export default function AnalyzePage() {
  const router = useRouter();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<AnalyzeError | null>(null);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    setCurrentStage(0);
    setError(null);

    // Start stage animation in parallel with actual request
    const stageInterval = setInterval(() => {
      setCurrentStage((prev) => {
        if (prev < stages.length - 2) return prev + 1;
        clearInterval(stageInterval);
        return prev;
      });
    }, 800 + Math.random() * 400);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      clearInterval(stageInterval);

      if (!response.ok) {
        const data = await response.json();
        const code: string | undefined = data.code;
        const message: string =
          data.error || `Ошибка при анализе (HTTP ${response.status})`;

        setError({
          message,
          code,
          upgradeNeeded:
            code === "QUOTA_EXCEEDED" ||
            code === "OCR_NOT_AVAILABLE_ON_FREE",
          authNeeded: code === "OCR_REQUIRES_AUTH",
          compressHint: code === "DOCUMENT_TOO_LARGE_FOR_OCR",
        });
        setIsAnalyzing(false);
        return;
      }

      const result = await response.json();

      // Show final stages
      setCurrentStage(stages.length - 1);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Store result in sessionStorage for the report page
      sessionStorage.setItem("analysisResult", JSON.stringify(result));

      // Navigate to report
      if (result.documentId) {
        router.push(`/report/${result.documentId}`);
      } else {
        router.push("/report/latest");
      }
    } catch (err) {
      clearInterval(stageInterval);
      setIsAnalyzing(false);
      setError({
        message:
          err instanceof Error
            ? err.message
            : "Ошибка при анализе документа",
      });
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <Header />

      <main id="main-content" className="flex-1 bg-surface/30">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          {!isAnalyzing ? (
            <div className="animate-fade-in">
              {/* Header */}
              <div className="mb-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light">
                  <FileSearch className="h-7 w-7 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">
                  Анализ договора
                </h1>
                <p className="mt-2 text-muted">
                  Загрузите PDF или DOCX. Модель пройдёт по тексту со
                  справочником ГК РФ и вернёт структурированный отчёт.
                </p>
                <p className="mt-2 text-xs text-muted">
                  Хотите сначала посмотреть формат?{" "}
                  <Link
                    href="/sample-report"
                    className="font-semibold text-primary hover:underline"
                  >
                    Открыть пример отчёта →
                  </Link>
                </p>
              </div>

              {/* Upload zone */}
              <UploadZone onFileSelect={handleFileSelect} />

              {/* Error message */}
              {error && (
                <div className="mt-4 animate-fade-in space-y-3 rounded-xl border border-danger/30 bg-danger-light p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-danger mt-0.5" />
                    <p className="text-sm text-danger">{error.message}</p>
                  </div>

                  {error.upgradeNeeded && (
                    <Link
                      href="/billing"
                      className="ml-8 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
                    >
                      <Crown className="h-4 w-4" />
                      Перейти на «Про» — безлимит
                    </Link>
                  )}

                  {error.authNeeded && (
                    <Link
                      href="/login"
                      className="ml-8 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
                    >
                      <LogIn className="h-4 w-4" />
                      Войти в аккаунт
                    </Link>
                  )}

                  {error.compressHint && (
                    <a
                      href="https://www.ilovepdf.com/compress_pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-8 inline-flex items-center gap-2 rounded-lg border border-danger/40 bg-card px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger-light"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Сжать PDF на ilovepdf.com
                    </a>
                  )}
                </div>
              )}

              {/* Analyze button */}
              {selectedFile && (
                <div className="mt-6 animate-scale-in text-center">
                  <button
                    onClick={handleAnalyze}
                    className="group inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-dark hover:shadow-xl"
                  >
                    <Scale className="h-5 w-5" />
                    Начать анализ
                  </button>
                </div>
              )}

              {/* Info */}
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {[
                  { label: "Время анализа", value: "~30 секунд" },
                  { label: "Поддержка", value: "PDF, DOCX, TXT" },
                  { label: "Максимальный размер", value: "10 МБ" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-border bg-card p-4 text-center"
                  >
                    <p className="text-sm font-bold text-foreground">
                      {item.value}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Analysis in progress */
            <div className="animate-fade-in text-center py-16">
              <div className="relative mx-auto mb-8 h-24 w-24">
                <div className="absolute inset-0 rounded-full border-4 border-border" />
                <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Scale className="h-10 w-10 text-primary animate-pulse-ring" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-foreground">
                Проверяем ваш договор
              </h2>
              <p className="mt-2 text-sm text-muted">
                Обычно 30–60 секунд. Не закрывайте вкладку.
              </p>

              <div className="mx-auto mt-10 max-w-md">
                <div className="space-y-3 text-left">
                  {stages.map((stage, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 rounded-lg px-4 py-2.5 transition-all ${
                        i < currentStage
                          ? "bg-success-light text-success"
                          : i === currentStage
                            ? "bg-primary-light text-primary-dark"
                            : "text-muted/50"
                      }`}
                    >
                      {i < currentStage ? (
                        <CheckCircle className="h-4 w-4 shrink-0 text-success" />
                      ) : i === currentStage ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                      ) : (
                        <div className="h-4 w-4 shrink-0 rounded-full border-2 border-current opacity-30" />
                      )}
                      <span className="text-sm font-medium">{stage}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Disclaimer />
    </div>
  );
}
