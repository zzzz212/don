"use client";

// "Send as Deal" — modal shown on the contract analysis report page.
// Lets the owner create a Deal Room from an analysed document and send
// an invite email to the counterparty. Mirrors the style of
// send-for-review.tsx (network layer), adapting for the Sprint 14
// Deal Room flow (no connection required — public invite token).

import { useState } from "react";
import { Loader2, Send, X, Check, Handshake } from "lucide-react";
import { Button, buttonClass } from "@/components/button";

export function SendAsDeal({
  documentId,
  onClose,
}: {
  documentId: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          documentId,
          counterpartyEmail: email.trim(),
          counterpartyName: name.trim() || undefined,
          message: message.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          (data as { error?: string })?.error ?? "Не удалось создать сделку"
        );
        return;
      }
      const data = (await res.json()) as { url: string };
      setResult({ url: data.url });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 backdrop-blur-md px-4 py-6 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Отправить договор второй стороне"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Handshake className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 className="text-sm font-bold text-foreground">
              {result ? "Сделка создана" : "Отправить второй стороне"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-lg p-1 text-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          {result ? (
            /* ── Success state ─────────────────────────────── */
            <div>
              <div className="mb-4 flex items-center justify-center py-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-light">
                  <Check className="h-6 w-6 text-success" />
                </div>
              </div>
              <p className="text-center font-semibold text-foreground mb-1">
                Письмо отправлено контрагенту
              </p>
              <p className="text-center text-sm text-muted mb-4">
                Также вы можете скопировать ссылку и передать её напрямую:
              </p>
              <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm break-all font-mono text-foreground mb-4">
                {result.url}
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(result.url);
                  }}
                  className={buttonClass({ variant: "primary" })}
                >
                  Скопировать ссылку
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className={buttonClass({ variant: "ghost" })}
                >
                  Закрыть
                </button>
              </div>
            </div>
          ) : (
            /* ── Form state ────────────────────────────────── */
            <div>
              <p className="text-sm text-muted mb-4">
                Контрагент откроет договор без регистрации. Он увидит ваш
                разбор и сможет согласовать пункты или предложить правки.
              </p>

              <label className="block mb-3">
                <span className="text-xs font-medium text-muted">
                  Email контрагента
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="counterparty@example.com"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  autoFocus
                />
              </label>

              <label className="block mb-3">
                <span className="text-xs font-medium text-muted">
                  Имя контрагента (необязательно)
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Иван Иванов"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>

              <label className="block mb-4">
                <span className="text-xs font-medium text-muted">
                  Сообщение (необязательно)
                </span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  placeholder="Направляю договор на согласование. Просьба ознакомиться с замечаниями."
                  className="mt-1 w-full resize-y rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>

              {error && (
                <p className="mb-3 text-sm text-danger">{error}</p>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={!email.trim() || submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-dark disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-4 w-4" aria-hidden="true" />
                )}
                {submitting ? "Отправляем…" : "Отправить"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
