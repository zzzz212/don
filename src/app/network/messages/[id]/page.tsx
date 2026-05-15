"use client";

import { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { ArrowLeft, Loader2, Send, AlertCircle } from "lucide-react";

interface Msg {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

interface Thread {
  conversationId: string;
  counterpart: { displayName: string; image: string | null };
  messages: Msg[];
}

export default function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load once, then poll quietly — there is no socket, so a light 12s
  // refresh keeps an open thread roughly live without hammering the API.
  useEffect(() => {
    void load(false);
    const timer = setInterval(() => void load(true), 12000);
    return () => clearInterval(timer);
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages.length]);

  async function load(silent: boolean) {
    if (!silent) setLoading(true);
    try {
      const r = await fetch(`/api/network/messages/${id}`);
      if (r.ok) {
        setThread(await r.json());
      } else if (!silent) {
        setError((await r.json()).error ?? "Переписка не найдена");
      }
    } catch {
      if (!silent) setError("Не удалось загрузить переписку");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const r = await fetch(`/api/network/messages/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (r.ok) {
        const { message } = await r.json();
        setThread((t) =>
          t ? { ...t, messages: [...t.messages, message] } : t
        );
        setDraft("");
      }
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-full flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted" />
        </main>
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className="flex min-h-full flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center px-4">
          <div className="text-center">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-warning" />
            <p className="mb-4 text-muted">
              {error ?? "Переписка не найдена"}
            </p>
            <Link
              href="/network/messages"
              className="text-sm font-semibold text-primary hover:underline"
            >
              К сообщениям
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main className="flex flex-1 flex-col bg-surface/30">
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6 sm:px-6">
          <div className="mb-3 flex items-center gap-3">
            <Link
              href="/network/messages"
              aria-label="К сообщениям"
              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-fg">
              {thread.counterpart.displayName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </div>
            <h1 className="font-bold text-foreground">
              {thread.counterpart.displayName}
            </h1>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border bg-card p-4">
            {thread.messages.length === 0 && (
              <p className="py-8 text-center text-sm text-muted">
                Сообщений пока нет. Напишите первым.
              </p>
            )}
            {thread.messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.mine ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    m.mine
                      ? "bg-primary text-primary-fg"
                      : "bg-surface text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </div>
                <span className="mt-0.5 text-[11px] text-muted">
                  {new Date(m.createdAt).toLocaleString("ru-RU", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Composer */}
          <div className="mt-3 flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              placeholder="Сообщение… (Enter — отправить)"
              className="flex-1 resize-y rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || draft.trim().length === 0}
              aria-label="Отправить"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-fg transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
