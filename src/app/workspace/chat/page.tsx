"use client";

// Workspace team chat — a single shared channel for everyone in the
// active workspace. Polls every 10s (same lightweight approach as the
// network direct-message thread).

import { useEffect, useRef, useState, useCallback } from "react";
import { AppShell } from "@/components/app-shell";
import { DocAttachmentCard } from "@/components/doc-attachment-card";
import {
  MessagesSquare,
  Send,
  Loader2,
  AlertCircle,
  Eye,
} from "lucide-react";

interface ChatMessage {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  senderName: string;
  senderImage: string | null;
  isMe: boolean;
  attachment: { id: string; name: string } | null;
}

const POLL_MS = 10_000;

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
  });
}

function Avatar({ name, image }: { name: string; image: string | null }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={image}
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    );
  }
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-fg"
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

export default function WorkspaceChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [canPost, setCanPost] = useState(true);
  const [orgName, setOrgName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/workspace/chat");
      if (!r.ok) {
        if (!loaded) setError("Не удалось загрузить чат компании");
        return;
      }
      const d = await r.json();
      setMessages(d.messages);
      setCanPost(d.canPost);
      setOrgName(d.orgName ?? "");
      setError(null);
    } catch {
      if (!loaded) setError("Сеть недоступна");
    } finally {
      setLoaded(true);
    }
  }, [loaded]);

  useEffect(() => {
    void load();
    const handle = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(handle);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const r = await fetch("/api/workspace/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error ?? "Не удалось отправить сообщение");
        return;
      }
      setMessages((prev) => [...prev, d.message]);
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell>
        <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-3xl flex-col px-4 py-6 sm:px-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light">
              <MessagesSquare className="h-5 w-5 text-primary-dark" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Чат компании
              </h1>
              <p className="text-sm text-muted">
                {orgName
                  ? `Внутренний чат рабочего пространства «${orgName}»`
                  : "Внутренний чат рабочего пространства"}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto rounded-2xl border border-border bg-card p-4">
            {!loaded ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted" />
              </div>
            ) : error && messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="flex items-center gap-2 text-sm text-danger">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <MessagesSquare className="mb-3 h-9 w-9 text-muted/40" />
                <p className="text-sm text-muted">
                  Здесь пока пусто. Напишите первое сообщение команде.
                </p>
              </div>
            ) : (
              <ul className="space-y-1">
                {messages.map((m, i) => {
                  const prev = messages[i - 1];
                  const newDay =
                    !prev ||
                    dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
                  // Group consecutive messages from the same sender.
                  const grouped =
                    !newDay && prev && prev.senderId === m.senderId;
                  return (
                    <li key={m.id}>
                      {newDay && (
                        <div className="my-3 text-center">
                          <span className="rounded-full bg-surface px-3 py-0.5 text-xs text-muted">
                            {dayLabel(m.createdAt)}
                          </span>
                        </div>
                      )}
                      <div
                        className={`flex gap-3 ${
                          grouped ? "mt-0.5" : "mt-3"
                        }`}
                      >
                        <div className="w-9 shrink-0">
                          {!grouped && (
                            <Avatar
                              name={m.senderName}
                              image={m.senderImage}
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          {!grouped && (
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm font-semibold text-foreground">
                                {m.isMe ? "Вы" : m.senderName}
                              </span>
                              <span className="text-xs text-muted">
                                {timeLabel(m.createdAt)}
                              </span>
                            </div>
                          )}
                          {m.body && (
                            <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                              {m.body}
                            </p>
                          )}
                          {m.attachment && (
                            <DocAttachmentCard
                              name={m.attachment.name}
                              href={`/generated/${m.attachment.id}`}
                            />
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
                <div ref={bottomRef} />
              </ul>
            )}
          </div>

          {/* Composer */}
          {canPost ? (
            <div className="mt-3">
              {error && messages.length > 0 && (
                <p className="mb-2 text-xs text-danger">{error}</p>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={1}
                  maxLength={4000}
                  placeholder="Сообщение команде…"
                  className="max-h-32 flex-1 resize-y rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={sending || draft.trim().length === 0}
                  aria-label="Отправить"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-fg transition-colors hover:bg-primary-dark disabled:opacity-50"
                >
                  {sending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-muted">
              <Eye className="h-4 w-4" />
              Роль «Наблюдатель» — вы можете читать чат, но не писать в него.
            </p>
          )}
        </div>
      </AppShell>
  );
}
