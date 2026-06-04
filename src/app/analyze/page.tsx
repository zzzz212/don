"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { UploadZone } from "@/components/upload-zone";
import { Button, buttonClass } from "@/components/button";
import { ActiveAnalysesStrip } from "@/components/active-analyses-strip";
import type { AnalysisJobView } from "@/lib/analyze/job";
import {
  FileSearch,
  Upload,
  ClipboardPaste,
  Scale,
  AlertTriangle,
  Crown,
  ExternalLink,
  LogIn,
} from "lucide-react";

interface AnalyzeError {
  message: string;
  code?: string;
  upgradeNeeded?: boolean;
  authNeeded?: boolean;
  compressHint?: boolean;
}

// Below this, a paste is almost certainly a fragment, not a contract —
// guard the button so the user doesn't spend an analysis on a snippet.
const MIN_PASTE_LENGTH = 200;

export default function AnalyzePage() {
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<AnalyzeError | null>(null);
  const [mode, setMode] = useState<"file" | "text">("file");
  const [pastedText, setPastedText] = useState("");
  const pasteLength = pastedText.trim().length;

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setError(null);
  };

  const handleAnalyze = async (file: File) => {
    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/analyze/start", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        const code: string | undefined = data.code;
        const message: string =
          data.error || `Ошибка при создании анализа (HTTP ${response.status})`;
        setError({
          message,
          code,
          upgradeNeeded:
            code === "QUOTA_EXCEEDED" || code === "OCR_NOT_AVAILABLE",
          authNeeded: response.status === 401,
          compressHint: code === "DOCUMENT_TOO_LARGE_FOR_OCR",
        });
        return;
      }

      const { analysisId, documentId } = (await response.json()) as {
        analysisId: string;
        documentId: string;
      };

      // Notify the strip — it picks up the job, starts polling, shows
      // the row. Page stays put; user can start another analysis or
      // navigate freely.
      const job: AnalysisJobView = {
        analysisId,
        documentId,
        fileName: file.name,
        status: "PENDING",
        stage: "parsing",
        progress: 0,
        errorMessage: null,
        startedAt: new Date().toISOString(),
        finishedAt: null,
      };
      window.dispatchEvent(
        new CustomEvent("yakso:analyze-started", { detail: job })
      );

      // Reset the upload form for the next analysis (parallel mode).
      setSelectedFile(null);
      setPastedText("");
    } catch (err) {
      setError({
        message:
          err instanceof Error
            ? err.message
            : "Ошибка при создании анализа",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnalyzeText = () => {
    const text = pastedText.trim();
    if (text.length < MIN_PASTE_LENGTH) return;
    const file = new File([text], "Вставленный договор.txt", {
      type: "text/plain",
    });
    void handleAnalyze(file);
  };

  return (
    <AppShell>
      <ActiveAnalysesStrip />
      <PageHeader
        title="Анализ договора"
        description="Загрузите PDF или DOCX. Анализ запустится в фоне — можете загрузить ещё один или закрыть вкладку."
        actions={
          <Link
            href="/sample-report"
            className={buttonClass({ variant: "secondary", size: "sm" })}
          >
            <FileSearch className="h-4 w-4" aria-hidden="true" />
            Открыть пример отчёта
          </Link>
        }
      />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="animate-fade-in">
          {/* Source toggle */}
          <div className="mb-5 flex justify-center">
            <div className="inline-flex rounded-xl border border-border bg-card p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("file");
                  setError(null);
                }}
                aria-pressed={mode === "file"}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  mode === "file"
                    ? "bg-primary text-primary-fg"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                Загрузить файл
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("text");
                  setError(null);
                }}
                aria-pressed={mode === "text"}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  mode === "text"
                    ? "bg-primary text-primary-fg"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
                Вставить текст
              </button>
            </div>
          </div>

          {mode === "file" ? (
            <div className="animate-fade-in">
              <UploadZone onFileSelect={handleFileSelect} />
              <p className="mt-3 text-center text-xs text-muted">
                Нужно проверить несколько договоров сразу?{" "}
                <Link
                  href="/bulk"
                  className="font-semibold text-primary hover:underline"
                >
                  Массовая проверка →
                </Link>
              </p>
              {selectedFile && (
                <div className="mt-6 animate-scale-in text-center">
                  <Button
                    size="lg"
                    loading={submitting}
                    onClick={() =>
                      selectedFile && handleAnalyze(selectedFile)
                    }
                  >
                    <Scale className="h-5 w-5" aria-hidden="true" />
                    {submitting ? "Запускаем…" : "Начать анализ"}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="animate-fade-in">
              <label
                htmlFor="paste-area"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Текст договора
              </label>
              <textarea
                id="paste-area"
                value={pastedText}
                onChange={(e) => {
                  setPastedText(e.target.value);
                  setError(null);
                }}
                rows={14}
                placeholder="Вставьте сюда полный текст договора — например, скопированный из письма или мессенджера."
                className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted/60 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="mt-1.5 text-xs text-muted">
                {pasteLength === 0
                  ? `Вставьте не меньше ${MIN_PASTE_LENGTH} символов.`
                  : pasteLength < MIN_PASTE_LENGTH
                    ? `Ещё ${MIN_PASTE_LENGTH - pasteLength} символов до минимума.`
                    : `${pasteLength.toLocaleString("ru-RU")} символов — можно анализировать.`}
              </p>
              <div className="mt-5 text-center">
                <Button
                  size="lg"
                  loading={submitting}
                  onClick={handleAnalyzeText}
                  disabled={pasteLength < MIN_PASTE_LENGTH || submitting}
                >
                  <Scale className="h-5 w-5" aria-hidden="true" />
                  {submitting ? "Запускаем…" : "Начать анализ"}
                </Button>
              </div>
            </div>
          )}

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
                  className={buttonClass({ size: "sm", className: "ml-8" })}
                >
                  <Crown className="h-4 w-4" />
                  Перейти на «Про» — безлимит
                </Link>
              )}
              {error.authNeeded && (
                <Link
                  href="/login"
                  className={buttonClass({ size: "sm", className: "ml-8" })}
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
                <p className="text-sm font-semibold text-foreground">
                  {item.value}
                </p>
                <p className="mt-0.5 text-xs text-muted">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
