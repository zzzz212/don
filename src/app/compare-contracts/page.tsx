"use client";

// Compare two contracts — the user's draft against a counterparty's
// version — and surface the substantive changes with an AI read on
// which way each one cuts.

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  GitCompare,
  Upload,
  Loader2,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Minus,
  FileText,
} from "lucide-react";

interface Change {
  section: string;
  change: string;
  impact: "risk" | "neutral" | "improvement";
  detail: string;
}

interface DiffPart {
  value: string;
  added: boolean;
  removed: boolean;
}

interface CompareResponse {
  ai: { summary: string; changes: Change[] };
  diff: DiffPart[];
  fileA: string;
  fileB: string;
}

const IMPACT: Record<
  Change["impact"],
  { label: string; cls: string; icon: typeof AlertTriangle }
> = {
  risk: {
    label: "Риск для вас",
    cls: "border-danger/30 bg-danger-light text-danger",
    icon: AlertTriangle,
  },
  improvement: {
    label: "В вашу пользу",
    cls: "border-success/30 bg-success-light text-success",
    icon: ArrowUpRight,
  },
  neutral: {
    label: "Нейтрально",
    cls: "border-border bg-surface text-muted",
    icon: Minus,
  },
};

function FilePicker({
  label,
  hint,
  file,
  onPick,
}: {
  label: string;
  hint: string;
  file: File | null;
  onPick: (f: File | null) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="mb-3 text-xs text-muted">{hint}</p>
      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-3 py-3 text-sm text-muted transition-colors hover:border-primary">
        <Upload className="h-4 w-4 shrink-0" />
        <span className="truncate">
          {file ? file.name : "Выберите файл (PDF, DOCX, TXT)"}
        </span>
        <input
          type="file"
          accept=".pdf,.docx,.doc,.txt"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          className="hidden"
        />
      </label>
    </div>
  );
}

export default function CompareContractsPage() {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  async function compare() {
    if (!fileA || !fileB) {
      setError("Приложите оба файла");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("fileA", fileA);
      fd.append("fileB", fileB);
      const r = await fetch("/api/compare-contracts", {
        method: "POST",
        body: fd,
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error ?? "Не удалось сравнить договоры");
        return;
      }
      if (d.demo) {
        setError("Сравнение недоступно в демо-режиме (AI-провайдер не настроен).");
        return;
      }
      setResult(d as CompareResponse);
    } catch {
      setError("Сеть недоступна");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light">
              <GitCompare className="h-5 w-5 text-primary-dark" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Сравнение двух договоров
              </h1>
              <p className="text-sm text-muted">
                Загрузите свою версию и версию контрагента — AI покажет,
                что изменилось и чем это грозит.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FilePicker
              label="Версия A — ваша"
              hint="Исходный договор или ваш вариант"
              file={fileA}
              onPick={setFileA}
            />
            <FilePicker
              label="Версия B — контрагента"
              hint="Правка или встречный вариант"
              file={fileB}
              onPick={setFileB}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-light px-4 py-3 text-sm text-danger"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="button"
            onClick={compare}
            disabled={loading || !fileA || !fileB}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Сравниваем…
              </>
            ) : (
              <>
                <GitCompare className="h-4 w-4" />
                Сравнить договоры
              </>
            )}
          </button>

          {result && (
            <div className="mt-8 space-y-6">
              <section className="rounded-2xl border border-border bg-card p-5">
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted">
                  Итог сравнения
                </h2>
                <p className="text-sm leading-relaxed text-foreground">
                  {result.ai.summary}
                </p>
                <p className="mt-3 text-xs text-muted">
                  Это автоматическая оценка, а не юридическая консультация.
                </p>
              </section>

              {result.ai.changes.length > 0 && (
                <section>
                  <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">
                    Содержательные отличия ({result.ai.changes.length})
                  </h2>
                  <div className="space-y-2.5">
                    {result.ai.changes.map((c, i) => {
                      const meta = IMPACT[c.impact];
                      const Icon = meta.icon;
                      return (
                        <div
                          key={i}
                          className="rounded-xl border border-border bg-card p-4"
                        >
                          <div className="mb-1.5 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-semibold ${meta.cls}`}
                            >
                              <Icon className="h-3 w-3" />
                              {meta.label}
                            </span>
                            <span className="text-sm font-semibold text-foreground">
                              {c.section}
                            </span>
                          </div>
                          <p className="text-sm text-foreground">{c.change}</p>
                          <p className="mt-1 text-sm text-muted">{c.detail}</p>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              <section>
                <button
                  type="button"
                  onClick={() => setShowDiff((v) => !v)}
                  className="flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary-dark"
                >
                  <FileText className="h-4 w-4" />
                  {showDiff
                    ? "Скрыть текстовые различия"
                    : "Показать текстовые различия"}
                </button>
                {showDiff && (
                  <div className="mt-3 max-h-[28rem] overflow-auto rounded-xl border border-border bg-card p-3 font-mono text-xs leading-relaxed">
                    {result.diff.map((part, i) => (
                      <div
                        key={i}
                        className={
                          part.added
                            ? "whitespace-pre-wrap bg-success-light text-success"
                            : part.removed
                              ? "whitespace-pre-wrap bg-danger-light text-danger line-through"
                              : "whitespace-pre-wrap text-muted"
                        }
                      >
                        {part.value}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </AppShell>
  );
}
