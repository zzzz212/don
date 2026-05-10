"use client";

// "Доработать AI" panel for /generated/[id]. Drops a textarea + submit
// button, opens a streaming preview when fired, persists as a new
// DocumentVersion server-side, and on completion either reloads the
// page (so the version count, content, badges all refresh together)
// or surfaces the error.

import { useRef, useState } from "react";
import {
  Sparkles,
  Loader2,
  X,
  AlertCircle,
  CheckCircle2,
  Wand2,
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
  const [streaming, setStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const toast = useToast();

  const reset = () => {
    setInstruction("");
    setStreaming(false);
    setStreamedText("");
    setError(null);
    setSaved(false);
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  };

  const close = () => {
    reset();
    setOpen(false);
  };

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  };

  const handleSubmit = async () => {
    if (instruction.trim().length < 5) {
      setError("Опишите подробнее, что нужно изменить.");
      return;
    }

    setError(null);
    setStreamedText("");
    setSaved(false);
    setStreaming(true);

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
      setStreaming(false);
      if (!aborted) {
        setError("Сеть недоступна. Попробуйте ещё раз.");
      }
      return;
    }

    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      setStreaming(false);
      setError(json.error ?? `Ошибка ${response.status}`);
      return;
    }

    if (!response.body) {
      setStreaming(false);
      setError("Сервер не вернул поток. Попробуйте ещё раз.");
      return;
    }

    try {
      for await (const event of parseSseStream(response.body)) {
        if (event.kind === "delta") {
          setStreamedText((prev) => prev + event.text);
        } else if (event.kind === "error") {
          setError(event.message);
          setStreaming(false);
          return;
        } else if (event.kind === "saved") {
          setSaved(true);
          setStreaming(false);
          toast.success(
            `Создана версия ${event.payload.versionNumber ?? ""}. Документ обновлён.`
          );
          // Give the user a beat to see the green confirmation card
          // before we reload the page.
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
      setStreaming(false);
      abortRef.current = null;
    }
  };

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 py-6 sm:items-center">
      <div className="flex w-full max-w-3xl flex-col rounded-2xl border border-border bg-white shadow-2xl">
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
                Напишите, что нужно изменить — AI перепишет договор и
                сохранит как новую версию.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={streaming}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface hover:text-foreground disabled:opacity-50"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-5 py-4">
          {!streaming && !saved && streamedText.length === 0 && (
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
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="mt-1 text-right text-xs text-muted">
                  {instruction.length} / 2000
                </p>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-muted">
                  Примеры:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setInstruction(s)}
                      className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-muted transition-colors hover:bg-white hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          {(streaming || streamedText.length > 0) && (
            <div className="rounded-xl border border-border bg-surface/50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                  {saved ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      Готово · сохраняем
                    </>
                  ) : streaming ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      AI пишет…
                    </>
                  ) : (
                    "Превью результата"
                  )}
                </p>
                <p className="text-xs text-muted tabular-nums">
                  {streamedText.length} симв · из {currentContent.length}
                </p>
              </div>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground">
                {streamedText || "—"}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          {streaming ? (
            <button
              type="button"
              onClick={handleStop}
              className="flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
            >
              Остановить
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={close}
                className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
              >
                Закрыть
              </button>
              {!saved && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={instruction.trim().length < 5}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  Запустить AI
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
