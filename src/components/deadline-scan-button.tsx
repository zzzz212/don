"use client";

// "Find deadlines" action for the analysis report page. One click runs
// the AI date extraction for this contract and links through to the
// /deadlines calendar.

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, Loader2, Check, AlertCircle } from "lucide-react";

export function DeadlineScanButton({ documentId }: { documentId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState("");

  async function scan() {
    setState("loading");
    try {
      const r = await fetch(`/api/documents/${documentId}/deadlines`, {
        method: "POST",
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMessage(d.error ?? "Не удалось распознать сроки");
        setState("error");
        return;
      }
      setCount(typeof d.count === "number" ? d.count : 0);
      setState("done");
    } catch {
      setMessage("Сеть недоступна");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <Link
        href="/deadlines"
        className="flex items-center gap-2 rounded-xl border border-success/40 bg-success-light px-4 py-2 text-sm font-semibold text-success transition-colors hover:bg-success/20"
      >
        <Check className="h-4 w-4" />
        {count > 0
          ? `Сроков найдено: ${count} — открыть`
          : "Ключевых дат не найдено"}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={scan}
      disabled={state === "loading"}
      title={state === "error" ? message : "Найти ключевые даты договора"}
      className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface disabled:opacity-50"
    >
      {state === "loading" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : state === "error" ? (
        <AlertCircle className="h-4 w-4 text-danger" />
      ) : (
        <CalendarClock className="h-4 w-4" />
      )}
      Найти сроки
    </button>
  );
}
