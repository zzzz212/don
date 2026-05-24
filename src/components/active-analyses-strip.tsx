"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { X, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { AnalysisJobView } from "@/lib/analyze/job";

// Sticky multi-track panel. Sits above page content on /analyze and
// /dashboard. Polls every 2.5s for each active job; on COMPLETED the
// row converts to a "Перейти к отчёту →" link for 5 seconds, then
// drops out of view.
//
// Local state of in-flight job IDs is mirrored to localStorage so a
// reload mid-analysis re-hydrates the same set of jobs.

const POLL_INTERVAL_MS = 2_500;
const COMPLETED_DISPLAY_MS = 5_000;
const LS_KEY = "yakso.activeAnalyses";

interface DisplayJob extends AnalysisJobView {
  /** Set to a timestamp when status flips to COMPLETED; row removes after COMPLETED_DISPLAY_MS */
  completedAt?: number;
}

export function ActiveAnalysesStrip() {
  const [jobs, setJobs] = useState<DisplayJob[]>([]);
  const pollHandles = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // Persist active job ids to localStorage so reload preserves them.
  const writeLocalStorage = useCallback((current: DisplayJob[]) => {
    const inFlight = current
      .filter((j) => j.status === "PENDING" || j.status === "RUNNING")
      .map((j) => j.analysisId);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(inFlight));
    } catch {
      // ignore
    }
  }, []);

  // Fetch a single job's status. Returns null if 404/403.
  const fetchStatus = useCallback(
    async (analysisId: string): Promise<Partial<AnalysisJobView> | null> => {
      try {
        const res = await fetch(`/api/analyze/${analysisId}/status`);
        if (!res.ok) return null;
        return (await res.json()) as Partial<AnalysisJobView>;
      } catch {
        return null;
      }
    },
    []
  );

  // Start polling a single job.
  const startPolling = useCallback(
    (analysisId: string) => {
      if (pollHandles.current.has(analysisId)) return;
      const handle = setInterval(async () => {
        const update = await fetchStatus(analysisId);
        if (!update) return;
        setJobs((prev) => {
          const next = prev.map((j) =>
            j.analysisId === analysisId
              ? {
                  ...j,
                  ...update,
                  completedAt:
                    update.status === "COMPLETED" && !j.completedAt
                      ? Date.now()
                      : j.completedAt,
                }
              : j
          );
          writeLocalStorage(next);
          return next;
        });
        if (
          update.status === "COMPLETED" ||
          update.status === "FAILED" ||
          update.status === "CANCELLED"
        ) {
          // Stop polling — this job is in a terminal state.
          const h = pollHandles.current.get(analysisId);
          if (h) {
            clearInterval(h);
            pollHandles.current.delete(analysisId);
          }
        }
      }, POLL_INTERVAL_MS);
      pollHandles.current.set(analysisId, handle);
    },
    [fetchStatus, writeLocalStorage]
  );

  // Remove a job from the strip (after COMPLETED display window or on cancel).
  const removeJob = useCallback(
    (analysisId: string) => {
      const h = pollHandles.current.get(analysisId);
      if (h) {
        clearInterval(h);
        pollHandles.current.delete(analysisId);
      }
      setJobs((prev) => {
        const next = prev.filter((j) => j.analysisId !== analysisId);
        writeLocalStorage(next);
        return next;
      });
    },
    [writeLocalStorage]
  );

  // Cancel a job via API.
  const cancelJob = useCallback(
    async (analysisId: string) => {
      try {
        await fetch(`/api/analyze/${analysisId}/cancel`, { method: "POST" });
      } catch {
        // ignore — UI removes optimistically
      }
      removeJob(analysisId);
    },
    [removeJob]
  );

  // Hydration on mount: server truth + local fallback.
  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      try {
        const res = await fetch("/api/analyze/active");
        if (!res.ok) return;
        const data = (await res.json()) as { jobs: AnalysisJobView[] };
        if (!mounted) return;
        setJobs(data.jobs);
        writeLocalStorage(data.jobs);
        for (const j of data.jobs) {
          if (j.status === "PENDING" || j.status === "RUNNING") {
            startPolling(j.analysisId);
          }
        }
      } catch {
        // ignore — strip just won't show until next start
      }
    }
    void hydrate();
    const handles = pollHandles.current;
    return () => {
      mounted = false;
      for (const h of handles.values()) clearInterval(h);
      handles.clear();
    };
  }, [startPolling, writeLocalStorage]);

  // Auto-remove COMPLETED rows after display window.
  useEffect(() => {
    const completedJobs = jobs.filter((j) => j.completedAt);
    if (completedJobs.length === 0) return;
    const timers = completedJobs.map((j) => {
      const elapsed = Date.now() - (j.completedAt ?? 0);
      const remaining = Math.max(0, COMPLETED_DISPLAY_MS - elapsed);
      return setTimeout(() => removeJob(j.analysisId), remaining);
    });
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [jobs, removeJob]);

  // Expose imperative API to parent via window event — /analyze page
  // dispatches a `yakso:analyze-started` event on successful POST /start.
  useEffect(() => {
    function onStarted(e: Event) {
      const detail = (e as CustomEvent<AnalysisJobView>).detail;
      setJobs((prev) => {
        if (prev.some((j) => j.analysisId === detail.analysisId)) return prev;
        const next = [detail, ...prev];
        writeLocalStorage(next);
        return next;
      });
      startPolling(detail.analysisId);
    }
    window.addEventListener("yakso:analyze-started", onStarted as EventListener);
    return () =>
      window.removeEventListener(
        "yakso:analyze-started",
        onStarted as EventListener
      );
  }, [startPolling, writeLocalStorage]);

  if (jobs.length === 0) return null;

  return (
    <div className="sticky top-0 z-30 border-b border-rule bg-card/95 backdrop-blur">
      <ul className="mx-auto flex max-w-5xl flex-col gap-2 px-5 py-3 sm:px-10">
        <AnimatePresence initial={false}>
          {jobs.map((j) => (
            <motion.li
              key={j.analysisId}
              layout
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-3"
            >
              <Indicator status={j.status} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">
                  {j.fileName}
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <ProgressBar progress={j.progress} status={j.status} />
                  <span className="text-[10px] uppercase tracking-[0.18em] text-ink-quiet">
                    {labelFor(j)}
                  </span>
                </div>
              </div>
              {j.status === "COMPLETED" ? (
                <Link
                  href={`/report/${j.documentId}`}
                  className="text-sm font-semibold text-success underline-offset-4 hover:underline"
                >
                  Перейти →
                </Link>
              ) : j.status === "FAILED" ? (
                <button
                  type="button"
                  onClick={() => removeJob(j.analysisId)}
                  className="text-sm font-semibold text-danger hover:underline"
                >
                  Закрыть
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void cancelJob(j.analysisId)}
                  className="text-ink-quiet/60 transition-colors hover:text-foreground"
                  aria-label="Отменить анализ"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

function Indicator({ status }: { status: AnalysisJobView["status"] }) {
  if (status === "COMPLETED")
    return <CheckCircle className="h-4 w-4 shrink-0 text-success" aria-hidden />;
  if (status === "FAILED")
    return <AlertTriangle className="h-4 w-4 shrink-0 text-danger" aria-hidden />;
  return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />;
}

function ProgressBar({
  progress,
  status,
}: {
  progress: number;
  status: AnalysisJobView["status"];
}) {
  const color =
    status === "COMPLETED"
      ? "bg-success"
      : status === "FAILED"
        ? "bg-danger"
        : "bg-primary";
  return (
    <div className="h-[2px] flex-1 max-w-[200px] bg-rule/40">
      <div
        className={`h-full transition-[width] duration-500 ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );
}

function labelFor(j: AnalysisJobView): string {
  if (j.status === "FAILED") return j.errorMessage ?? "Ошибка";
  if (j.status === "COMPLETED") return "Готово";
  if (j.status === "CANCELLED") return "Отменено";
  if (j.stage === "parsing") return "Читаем документ";
  if (j.stage === "chunking") return "Разбиваем на части";
  if (j.stage === "analyzing") return "Анализируем риски";
  if (j.stage === "synthesizing") return "Собираем отчёт";
  if (j.stage === "saving") return "Сохраняем";
  return "В работе";
}
