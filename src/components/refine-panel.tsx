"use client";

// "Доработать AI" panel for /generated/[id]. Two execution modes:
//
//   • PATCH (default): tiny output, AI returns a list of edit operations
//     and the server applies them. UI shows a quick "Применяем точечные
//     правки..." spinner — no streaming preview because there's nothing
//     to stream (the result is just patches against the existing doc).
//
//   • REGEN (fallback or user-forced): full document is streamed as the
//     AI types it. UI shows the live token-by-token preview so the user
//     sees progress on a long generation.
//
// The route emits a "mode" SSE event at the start of each path so this
// panel knows which UI state to show.

import { useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Sparkles,
  Loader2,
  X,
  AlertCircle,
  Wand2,
  Zap,
  RefreshCw,
} from "lucide-react";
import { parseSseStream } from "@/lib/sse-client";
import { useToast } from "@/components/toast";

interface Props {
  documentId: string;
  /** Existing document content — shown side-by-side with the AI output for
   *  the user to compare in real time as the AI streams. */
  currentContent: string;
  /** Called after a successful save — typically `() => router.refresh()`
   *  or a full reload so the versions sidebar updates. */
  onSaved: () => void;
}

type Phase =
  | "idle"
  | "patch-running"
  | "regen-streaming"
  | "saved";

const SUGGESTIONS = [
  "Добавить пункт о коммерческой тайне с штрафом за разглашение",
  "Сделать срок действия 6 месяцев с автопродлением",
  "Адаптировать договор под IT-сферу",
  "Усилить ответственность исполнителя",
  "Добавить условие об автоматическом повышении цены на 5% в год",
];

export function RefinePanel({
  documentId,
  currentContent,
  onSaved,
}: Props) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [streamedText, setStreamedText] = useState("");
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const toast = useToast();

  const reset = () => {
    setInstruction("");
    setPhase("idle");
    setStreamedText("");
    setFallbackReason(null);
    setError(null);
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  };

  const close = () => {
    reset();
    setOpen(false);
  };

  const isWorking = phase === "patch-running" || phase === "regen-streaming";

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("idle");
  };

  const handleSubmit = async () => {
    if (instruction.trim().length < 5) {
      setError("Опишите подробнее, что нужно изменить.");
      return;
    }

    setError(null);
    setStreamedText("");
    setFallbackReason(null);
    // We don't know yet whether the route will choose patch or regen —
    // start in patch-running and switch on the first "mode" event.
    setPhase("patch-running");

    const controller = new AbortController();
    abortRef.current = controller;

    let response: Response;
    try {
      response = await fetch(`/api/generated/${documentId}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: instruction.trim() }),
        signal: controller.signal,
      });
    } catch (e) {
      const aborted = (e as Error).name === "AbortError";
      setPhase("idle");
      if (!aborted) {
        setError("Сеть недоступна. Попробуйте ещё раз.");
      }
      return;
    }

    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setPhase("idle");
      setError(json.error ?? `Ошибка ${response.status}`);
      return;
    }

    if (!response.body) {
      setPhase("idle");
      setError("Сервер не вернул поток. Попробуйте ещё раз.");
      return;
    }

    try {
      for await (const event of parseSseStream(response.body)) {
        if (event.kind === "mode") {
          if (event.mode === "patch") {
            setPhase("patch-running");
          } else {
            setPhase("regen-streaming");
            if (event.reason) setFallbackReason(event.reason);
          }
        } else if (event.kind === "delta") {
          setStreamedText((prev) => prev + event.text);
        } else if (event.kind === "error") {
          setError(event.message);
          setPhase("idle");
          return;
        } else if (event.kind === "saved") {
          setPhase("saved");
          const versionNumber = event.payload.versionNumber as
            | number
            | undefined;
          const mode = (event.payload.mode as string) ?? "regen";
          const opsApplied = event.payload.opsApplied as number | undefined;
          if (mode === "patch" && opsApplied) {
            toast.success(
              `Создана версия ${versionNumber ?? ""}: применено ${opsApplied} ${pluralize(opsApplied, ["правка", "правки", "правок"])}.`
            );
          } else {
            toast.success(
              `Создана версия ${versionNumber ?? ""}. Документ переписан AI.`
            );
          }
          setTimeout(() => {
            close();
            onSaved();
          }, 900);
          return;
        }
      }
    } catch (e) {
      const aborted = (e as Error).name === "AbortError";
      if (!aborted) {
        setError("Соединение прервалось. Попробуйте ещё раз.");
      }
    } finally {
      // If the loop exited without saved/error, settle.
      setPhase((p) => (p === "saved" ? p : "idle"));
      abortRef.current = null;
    }
  };

  function pluralize(n: number, f: [string, string, string]): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return f[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return f[1];
    return f[2];
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary-light/30 px-3 py-2 text-sm font-medium text-primary-dark transition-colors hover:bg-primary-light/60"
        title="Изменить документ AI-инструкцией на естественном языке"
      >
        <Wand2 className="h-4 w-4" />
        Доработать AI
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm px-4 py-6 sm:items-center"
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 380, damping: 32, mass: 0.8 }}
        className="flex w-full max-w-3xl flex-col rounded-2xl border border-border bg-card shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Доработать документ AI
              </h2>
              <p className="text-xs text-muted">
                Опишите изменение — AI создаст новую версию документа.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={isWorking}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface hover:text-foreground disabled:opacity-50"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-5 py-4">
          {phase === "idle" && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Что нужно изменить?
                </label>
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  placeholder="Например: «Сделай срок 6 месяцев с автопродлением, добавь штраф 0,1% в день за просрочку оплаты и пункт о коммерческой тайне.»"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="mt-1 text-right text-xs text-muted">
                  {instruction.length} / 2000
                </p>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-muted">Примеры:</p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setInstruction(s)}
                      className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-muted transition-colors hover:bg-card hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-light px-3 py-2 text-sm text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          {phase === "patch-running" && (
            <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary-light/30 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
                <Zap className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-primary-dark">
                  Применяем точечные правки…
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  AI описывает изменения как небольшой набор операций — это
                  экономит токены и работает в 3–5 раз быстрее, чем
                  переписывать документ целиком.
                </p>
              </div>
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
            </div>
          )}

          {phase === "regen-streaming" && (
            <>
              {fallbackReason && (
                <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-light px-3 py-2 text-xs text-warning">
                  <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{fallbackReason}</span>
                </div>
              )}
              <div className="rounded-xl border border-border bg-surface/50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    AI переписывает документ…
                  </p>
                  <p className="text-xs text-muted tabular-nums">
                    {streamedText.length} симв · из {currentContent.length}
                  </p>
                </div>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground">
                  {streamedText || "—"}
                </pre>
              </div>
            </>
          )}

          {phase === "saved" && (
            <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/10 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success text-white">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-success">Готово!</p>
                <p className="mt-0.5 text-xs text-success">
                  Сохраняем версию и обновляем страницу…
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          {isWorking ? (
            <button
              type="button"
              onClick={handleStop}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
            >
              Остановить
            </button>
          ) : phase === "saved" ? (
            <span className="text-xs text-muted">Перенаправляем…</span>
          ) : (
            <>
              <button
                type="button"
                onClick={close}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
              >
                Закрыть
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={instruction.trim().length < 5}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                Запустить AI
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
