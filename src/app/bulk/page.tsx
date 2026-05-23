"use client";

// Bulk contract analysis. The page maintains a client-side queue and
// posts files one at a time to /api/analyze — the same endpoint the
// single-file flow uses, so quota, rate limiting, OCR, persistence and
// the resulting /report/[id] page all work unchanged.
//
// Why sequential (concurrency 1): /api/analyze is rate-limited to
// 10/min per IP and each call spends one analysis from the workspace
// quota. Firing a batch in parallel would trip the rate limiter and
// race the quota check. One-at-a-time also keeps the AI provider load
// predictable. The trade-off — a long wall-clock time for big batches —
// is why MAX_BULK_FILES caps the run.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { bulkFileError, BULK_ACCEPT, MAX_BULK_FILES } from "@/lib/bulk";
import { Button, buttonClass } from "@/components/button";
import {
  Layers,
  Upload,
  FileText,
  X,
  Loader2,
  CheckCircle,
  AlertOctagon,
  AlertTriangle,
  Crown,
  ExternalLink,
  RotateCw,
} from "lucide-react";

type Verdict = "sign" | "negotiate" | "do_not_sign";
type ItemStatus = "pending" | "running" | "done" | "error";

interface BulkItem {
  id: string;
  file: File;
  status: ItemStatus;
  documentId?: string | null;
  score?: number;
  verdict?: Verdict;
  error?: string;
  /** Error code from /api/analyze — drives the upgrade hint. */
  code?: string;
}

const VERDICT_META: Record<Verdict, { label: string; cls: string }> = {
  sign: { label: "Низкий риск", cls: "bg-success-light text-success" },
  negotiate: { label: "Средний риск", cls: "bg-warning-light text-warning" },
  do_not_sign: { label: "Высокий риск", cls: "bg-danger-light text-danger" },
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export default function BulkPage() {
  const [items, setItems] = useState<BulkItem[]>([]);
  const [started, setStarted] = useState(false);
  const [running, setRunning] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const cancelRef = useRef(false);

  // Warn before leaving while a batch is in flight — closing the tab
  // stops the queue (the work is client-driven).
  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  const patchItem = useCallback((id: string, patch: Partial<BulkItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it))
    );
  }, []);

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const incoming = Array.from(fileList);
      const accepted: BulkItem[] = [];
      const problems: string[] = [];
      let slots = MAX_BULK_FILES - items.length;

      for (const file of incoming) {
        const err = bulkFileError(file);
        if (err) {
          problems.push(`${file.name}: ${err}`);
          continue;
        }
        if (slots <= 0) {
          problems.push(
            `${file.name}: за один раз можно проверить не больше ${MAX_BULK_FILES} файлов`
          );
          continue;
        }
        accepted.push({ id: crypto.randomUUID(), file, status: "pending" });
        slots--;
      }

      if (accepted.length > 0) setItems((prev) => [...prev, ...accepted]);
      setRejected(problems);
    },
    [items.length]
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const resetAll = useCallback(() => {
    setItems([]);
    setStarted(false);
    setRunning(false);
    setRejected([]);
    cancelRef.current = false;
  }, []);

  const runQueue = useCallback(async () => {
    setStarted(true);
    setRunning(true);
    cancelRef.current = false;

    // Snapshot the queue — removing files is disabled while running, so
    // item identities are stable for the whole loop.
    const queue = items;
    for (const item of queue) {
      if (cancelRef.current) break;
      if (item.status !== "pending") continue;

      patchItem(item.id, { status: "running" });
      try {
        const formData = new FormData();
        formData.append("file", item.file);
        const res = await fetch("/api/analyze", {
          method: "POST",
          body: formData,
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          patchItem(item.id, {
            status: "error",
            error: data.error ?? `Ошибка ${res.status}`,
            code: data.code,
          });
          continue;
        }

        patchItem(item.id, {
          status: "done",
          documentId: data.documentId ?? null,
          score: data.score,
          verdict: data.verdict,
        });
      } catch {
        patchItem(item.id, {
          status: "error",
          error: "Сеть недоступна — попробуйте этот файл ещё раз.",
        });
      }
    }

    setRunning(false);
  }, [items, patchItem]);

  const retryItem = useCallback(
    (id: string) => {
      patchItem(id, {
        status: "pending",
        error: undefined,
        code: undefined,
      });
    },
    [patchItem]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    // Reset so selecting the same file again still fires onChange.
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const doneCount = items.filter(
    (i) => i.status === "done" || i.status === "error"
  ).length;
  const pendingCount = items.filter((i) => i.status === "pending").length;
  const okCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;
  const progressPct = items.length
    ? Math.round((doneCount / items.length) * 100)
    : 0;
  const quotaHit = items.some((i) => i.code === "QUOTA_EXCEEDED");
  const allSettled = started && !running && pendingCount === 0;

  return (
    <AppShell>
      <PageHeader
        title="Массовая проверка договоров"
        description={`Загрузите до ${MAX_BULK_FILES} файлов сразу — мы проверим их по очереди и сложим отчёты в дашборд.`}
      />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          {!started ? (
            <>
              {/* Drop zone */}
              <div
                onDragEnter={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                className={cn(
                  "group relative cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all",
                  isDragging
                    ? "scale-[1.01] border-primary bg-primary-light/30"
                    : "border-border hover:border-primary/50 hover:bg-surface/50"
                )}
              >
                <input
                  type="file"
                  multiple
                  accept={BULK_ACCEPT}
                  onChange={onInputChange}
                  aria-label="Выбрать файлы для массовой проверки"
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
                <div className="flex flex-col items-center gap-3">
                  <div
                    className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-2xl transition-colors",
                      isDragging
                        ? "bg-primary/10"
                        : "bg-surface group-hover:bg-primary/5"
                    )}
                  >
                    <Upload
                      className={cn(
                        "h-7 w-7 transition-colors",
                        isDragging
                          ? "text-primary"
                          : "text-muted group-hover:text-primary"
                      )}
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-foreground">
                      Перетащите файлы или нажмите для выбора
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      PDF, DOCX, DOC, TXT · до 10 МБ каждый · до{" "}
                      {MAX_BULK_FILES} файлов
                    </p>
                  </div>
                </div>
              </div>

              {/* Rejected files */}
              {rejected.length > 0 && (
                <div className="mt-4 rounded-xl border border-warning/30 bg-warning-light p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <div className="text-sm text-warning">
                      <p className="font-semibold">
                        Не добавлены в очередь:
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {rejected.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Selected files */}
              {items.length > 0 && (
                <>
                  <ul className="mt-6 space-y-2">
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                      >
                        <FileText
                          className="h-5 w-5 shrink-0 text-muted"
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {item.file.name}
                          </p>
                          <p className="text-xs text-muted">
                            {formatSize(item.file.size)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          aria-label={`Убрать ${item.file.name} из очереди`}
                          className="rounded-lg p-2 text-muted transition-colors hover:bg-surface hover:text-foreground"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 flex flex-col items-center gap-2">
                    <Button size="lg" onClick={runQueue}>
                      <Layers className="h-5 w-5" aria-hidden="true" />
                      Начать проверку
                    </Button>
                    <p className="text-xs text-muted">
                      В очереди: {items.length}. Договоры проверяются по
                      одному — не закрывайте вкладку.
                    </p>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              {/* Progress */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold text-foreground">
                    {running
                      ? "Проверяем договоры…"
                      : "Проверка завершена"}
                  </span>
                  <span className="tabular-nums text-muted">
                    Проверено {doneCount} из {items.length}
                  </span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-surface"
                  role="progressbar"
                  aria-valuenow={progressPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* Item rows */}
              <ul className="mt-4 space-y-2">
                {items.map((item) => {
                  const meta = item.verdict
                    ? VERDICT_META[item.verdict]
                    : null;
                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center"
                        aria-hidden="true"
                      >
                        {item.status === "pending" && (
                          <span className="h-2.5 w-2.5 rounded-full bg-muted/40" />
                        )}
                        {item.status === "running" && (
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        )}
                        {item.status === "done" && (
                          <CheckCircle className="h-5 w-5 text-success" />
                        )}
                        {item.status === "error" && (
                          <AlertOctagon className="h-5 w-5 text-danger" />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.file.name}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {item.status === "pending" && "В очереди"}
                          {item.status === "running" && "Анализируем…"}
                          {item.status === "done" &&
                            `Готово · оценка ${item.score ?? "—"}/10`}
                          {item.status === "error" && (
                            <span className="text-danger">{item.error}</span>
                          )}
                        </p>
                      </div>

                      {meta && (
                        <span
                          className={cn(
                            "shrink-0 rounded-md px-2 py-1 text-xs font-semibold",
                            meta.cls
                          )}
                        >
                          {meta.label}
                        </span>
                      )}

                      {item.status === "done" && item.documentId && (
                        <Link
                          href={`/report/${item.documentId}`}
                          className="shrink-0 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-surface"
                        >
                          Отчёт
                        </Link>
                      )}

                      {item.status === "error" && !running && (
                        <button
                          type="button"
                          onClick={() => retryItem(item.id)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-surface"
                        >
                          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                          Повторить
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>

              {/* Controls */}
              <div className="mt-6 flex flex-col items-center gap-3">
                {running && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      cancelRef.current = true;
                    }}
                  >
                    Остановить после текущего файла
                  </Button>
                )}

                {!running && pendingCount > 0 && (
                  <Button onClick={runQueue}>
                    <Layers className="h-4 w-4" aria-hidden="true" />
                    Продолжить ({pendingCount} в очереди)
                  </Button>
                )}

                {allSettled && (
                  <div className="w-full rounded-xl border border-border bg-card p-5 text-center">
                    <p className="text-sm font-semibold text-foreground">
                      Готово: {okCount} проверено
                      {errorCount > 0 ? `, ${errorCount} с ошибкой` : ""}.
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Отчёты доступны в дашборде.
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <Link
                        href="/dashboard"
                        className={buttonClass({ size: "sm" })}
                      >
                        Открыть дашборд
                      </Link>
                      <Button variant="secondary" size="sm" onClick={resetAll}>
                        Проверить ещё
                      </Button>
                    </div>
                  </div>
                )}

                {quotaHit && (
                  <Link href="/billing" className={buttonClass({ size: "sm" })}>
                    <Crown className="h-4 w-4" aria-hidden="true" />
                    Лимит тарифа исчерпан — перейти на «Про»
                  </Link>
                )}
              </div>
            </>
          )}

          {/* Single-file hint */}
          {!started && (
            <p className="mt-8 text-center text-xs text-muted">
              Нужно проверить один договор?{" "}
              <Link
                href="/analyze"
                className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
              >
                Обычный анализ
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </Link>
            </p>
          )}
      </div>
    </AppShell>
  );
}
