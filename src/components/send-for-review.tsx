"use client";

// "Send for review" — a button + modal shown on a contract's analysis
// page. Lets the owner forward the analysed contract to one of their
// network connections, who then reviews it and can comment on /network.

import { useState } from "react";
import Link from "next/link";
import { Send, X, Loader2, Check, Users } from "lucide-react";

interface Connected {
  userId: string;
  displayName: string;
  headline: string | null;
}

export function SendForReview({ documentId }: { documentId: string }) {
  const [open, setOpen] = useState(false);
  const [connections, setConnections] = useState<Connected[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openModal() {
    setOpen(true);
    setDone(false);
    setError(null);
    setSelected(null);
    setMessage("");
    if (connections === null) {
      try {
        const r = await fetch("/api/network/connections");
        setConnections(r.ok ? (await r.json()).connected : []);
      } catch {
        setConnections([]);
      }
    }
  }

  async function send() {
    if (!selected) return;
    setSending(true);
    setError(null);
    try {
      const r = await fetch("/api/network/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toUserId: selected,
          documentId,
          message: message.trim() || undefined,
        }),
      });
      if (r.ok) {
        setDone(true);
      } else {
        setError((await r.json()).error ?? "Не удалось отправить документ");
      }
    } catch {
      setError("Не удалось отправить документ");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
      >
        <Send className="h-4 w-4" />
        Отправить на ревью
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-foreground/40 backdrop-blur-sm px-4 py-6 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Отправить договор на ревью"
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-bold text-foreground">
                Отправить договор на ревью
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
                className="rounded-lg p-1 text-muted transition-colors hover:bg-surface hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-4">
              {done ? (
                <div className="py-6 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success-light">
                    <Check className="h-6 w-6 text-success" />
                  </div>
                  <p className="font-semibold text-foreground">
                    Документ отправлен
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Рецензент увидит его в разделе «Сеть» → «Ревью».
                  </p>
                </div>
              ) : connections === null ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted" />
                </div>
              ) : connections.length === 0 ? (
                <div className="py-6 text-center">
                  <Users className="mx-auto mb-3 h-8 w-8 text-muted/50" />
                  <p className="text-sm text-muted">
                    Отправлять документы можно только пользователям из ваших
                    связей. Сначала найдите коллег в каталоге.
                  </p>
                  <Link
                    href="/network"
                    className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
                  >
                    Открыть сеть
                  </Link>
                </div>
              ) : (
                <>
                  <p className="mb-2 text-xs font-medium text-muted">
                    Кому отправить
                  </p>
                  <div className="space-y-1.5">
                    {connections.map((c) => (
                      <button
                        key={c.userId}
                        type="button"
                        onClick={() => setSelected(c.userId)}
                        className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                          selected === c.userId
                            ? "border-primary bg-primary-light"
                            : "border-border bg-card hover:bg-surface"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {c.displayName}
                          </span>
                          {c.headline && (
                            <span className="block truncate text-xs text-muted">
                              {c.headline}
                            </span>
                          )}
                        </span>
                        {selected === c.userId && (
                          <Check className="h-4 w-4 shrink-0 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    placeholder="Сопроводительное сообщение (необязательно)"
                    className="mt-3 w-full resize-y rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />

                  {error && (
                    <p className="mt-2 text-sm text-danger">{error}</p>
                  )}

                  <button
                    type="button"
                    onClick={send}
                    disabled={!selected || sending}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-dark disabled:opacity-50"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Отправить
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
