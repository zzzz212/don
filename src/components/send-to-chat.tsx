"use client";

// "Forward to chat" action for a generated document. Opens a small modal
// where the user picks a destination — the workspace team channel or a
// connected counterparty's direct messages — and the document is sent as
// a message attachment.

import { useState } from "react";
import {
  Send,
  Loader2,
  X,
  Check,
  MessagesSquare,
  User as UserIcon,
} from "lucide-react";

interface Connection {
  userId: string;
  displayName: string;
}

export function SendToChat({
  documentId,
  documentName,
}: {
  documentId: string;
  documentName: string;
}) {
  const [open, setOpen] = useState(false);
  const [connections, setConnections] = useState<Connection[] | null>(null);
  // "workspace" or a connection's userId.
  const [dest, setDest] = useState<string>("workspace");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function openModal() {
    setOpen(true);
    setError(null);
    setDone(false);
    setDest("workspace");
    setMessage("");
    setConnections(null);
    fetch("/api/network/connections")
      .then((r) => (r.ok ? r.json() : { connected: [] }))
      .then((d) =>
        setConnections(
          (d.connected ?? []).map(
            (c: { userId: string; displayName: string }) => ({
              userId: c.userId,
              displayName: c.displayName,
            })
          )
        )
      )
      .catch(() => setConnections([]));
  }

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        body: message.trim(),
        attachmentGeneratedDocId: documentId,
      };
      if (dest === "workspace") {
        const r = await fetch("/api/workspace/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!r.ok) {
          setError((await r.json()).error ?? "Не удалось отправить");
          return;
        }
      } else {
        // Open (or reuse) the conversation, then post with the attachment.
        const conv = await fetch("/api/network/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toUserId: dest }),
        });
        if (!conv.ok) {
          setError((await conv.json()).error ?? "Не удалось открыть переписку");
          return;
        }
        const { conversationId } = await conv.json();
        const r = await fetch(`/api/network/messages/${conversationId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!r.ok) {
          setError((await r.json()).error ?? "Не удалось отправить");
          return;
        }
      }
      setDone(true);
      setTimeout(() => setOpen(false), 1300);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
      >
        <Send className="h-4 w-4" />
        В чат
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Отправить договор в чат
                </h2>
                <p className="truncate text-xs text-muted">{documentName}</p>
              </div>
              <button
                type="button"
                onClick={() => !busy && setOpen(false)}
                aria-label="Закрыть"
                className="text-muted transition-colors hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {done ? (
              <div className="flex items-center gap-2 rounded-xl bg-success-light px-4 py-6 text-sm font-medium text-success">
                <Check className="h-5 w-5" />
                Документ отправлен в чат.
              </div>
            ) : (
              <>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  Куда отправить
                </p>
                <div className="mb-3 max-h-56 space-y-1 overflow-y-auto">
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-light/40">
                    <input
                      type="radio"
                      name="dest"
                      checked={dest === "workspace"}
                      onChange={() => setDest("workspace")}
                      className="h-4 w-4 text-primary"
                    />
                    <MessagesSquare className="h-4 w-4 text-muted" />
                    <span className="font-medium text-foreground">
                      Чат компании
                    </span>
                  </label>
                  {connections === null ? (
                    <p className="px-3 py-2 text-xs text-muted">
                      Загрузка связей…
                    </p>
                  ) : connections.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted">
                      Нет связей для личной отправки. Добавьте коллег в
                      разделе «Сеть».
                    </p>
                  ) : (
                    connections.map((c) => (
                      <label
                        key={c.userId}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-light/40"
                      >
                        <input
                          type="radio"
                          name="dest"
                          checked={dest === c.userId}
                          onChange={() => setDest(c.userId)}
                          className="h-4 w-4 text-primary"
                        />
                        <UserIcon className="h-4 w-4 text-muted" />
                        <span className="truncate font-medium text-foreground">
                          {c.displayName}
                        </span>
                      </label>
                    ))
                  )}
                </div>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  maxLength={4000}
                  placeholder="Сопроводительное сообщение (необязательно)"
                  className="mb-3 w-full resize-y rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />

                {error && (
                  <p className="mb-3 text-xs text-danger">{error}</p>
                )}

                <button
                  type="button"
                  onClick={send}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-dark disabled:opacity-50"
                >
                  {busy ? (
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
      )}
    </>
  );
}
