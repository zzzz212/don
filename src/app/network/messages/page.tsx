"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ArrowLeft, Loader2, MessageSquare } from "lucide-react";

interface Conversation {
  id: string;
  counterpart: { displayName: string; image: string | null };
  lastMessage: { body: string; createdAt: string; mine: boolean } | null;
  unread: number;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function whenLabel(iso: string): string {
  const d = new Date(iso);
  const sameDay = new Date().toDateString() === d.toDateString();
  return d.toLocaleString("ru-RU", {
    ...(sameDay
      ? { hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "short" }),
  });
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[] | null>(
    null
  );

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/network/messages");
        setConversations(r.ok ? (await r.json()).conversations : []);
      } catch {
        setConversations([]);
      }
    })();
  }, []);

  return (
    <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href="/network"
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />К сети
          </Link>
          <h1 className="mb-5 text-2xl font-bold text-foreground">Сообщения</h1>

          {conversations === null ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card py-16 text-center">
              <MessageSquare className="mx-auto mb-3 h-8 w-8 text-muted/50" />
              <p className="mx-auto max-w-md text-sm text-muted">
                Здесь будут ваши диалоги. Чтобы написать коллеге, откройте
                вкладку «Связи» и нажмите «Написать».
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((c) => (
                <Link
                  key={c.id}
                  href={`/network/messages/${c.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 transition-colors hover:bg-surface/50"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-fg">
                    {initials(c.counterpart.displayName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-semibold text-foreground">
                        {c.counterpart.displayName}
                      </p>
                      {c.lastMessage && (
                        <span className="shrink-0 text-[11px] text-muted">
                          {whenLabel(c.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-sm text-muted">
                      {c.lastMessage
                        ? `${c.lastMessage.mine ? "Вы: " : ""}${c.lastMessage.body}`
                        : "Нет сообщений"}
                    </p>
                  </div>
                  {c.unread > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-fg">
                      {c.unread}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </AppShell>
  );
}
