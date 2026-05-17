"use client";

// Rendered on the counterparty-check page. When the searched ИНН belongs
// to a ЮрИИст account, this lets the user reach that account's
// representative — either opening an existing conversation or sending a
// connection request with an intro message. When no account owns the
// ИНН it shows a quiet hint instead.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  ShieldCheck,
  BadgeCheck,
  MessageSquare,
  Send,
  Clock,
  Check,
  UserPlus,
} from "lucide-react";

type ConnState = "none" | "connected" | "incoming" | "outgoing" | "declined";

interface Owner {
  userId: string;
  displayName: string;
  headline: string | null;
  image: string | null;
  innStatus: string;
  connection: ConnState;
}

function Avatar({ name, image }: { name: string; image: string | null }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={image}
        alt=""
        width={44}
        height={44}
        className="h-11 w-11 shrink-0 rounded-full object-cover"
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
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-fg"
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

export function ContactCounterparty({ inn }: { inn: string }) {
  const router = useRouter();
  const [owner, setOwner] = useState<Owner | null>(null);
  const [isSelf, setIsSelf] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [composing, setComposing] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setOwner(null);
    setIsSelf(false);
    setComposing(false);
    setRequested(false);
    setErr(null);
    fetch(`/api/network/by-inn/${encodeURIComponent(inn)}`)
      .then((r) => (r.ok ? r.json() : { owner: null }))
      .then((d) => {
        if (!cancelled) {
          setOwner(d.owner ?? null);
          setIsSelf(Boolean(d.self));
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [inn]);

  async function openConversation() {
    if (!owner) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/network/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: owner.userId }),
      });
      if (!r.ok) {
        setErr((await r.json()).error ?? "Не удалось открыть переписку");
        return;
      }
      const { conversationId } = await r.json();
      router.push(`/network/messages/${conversationId}`);
    } finally {
      setBusy(false);
    }
  }

  async function sendRequest() {
    if (!owner) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/network/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toUserId: owner.userId,
          message: message.trim() || undefined,
        }),
      });
      if (!r.ok) {
        setErr((await r.json()).error ?? "Не удалось отправить запрос");
        return;
      }
      setRequested(true);
      setComposing(false);
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  if (isSelf) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-4 text-sm text-muted">
        Этот ИНН привязан к вашему профилю — это ваша организация.
      </div>
    );
  }

  if (!owner) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-4 text-sm text-muted">
        Никто пока не привязал этот ИНН к своему профилю в ЮрИИст —
        написать напрямую нельзя. Кнопка связи появится, когда
        представитель компании привяжет ИНН в разделе «Сеть» → «Мой
        профиль».
      </div>
    );
  }

  const verified = owner.innStatus === "verified";

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
        <MessageSquare className="h-5 w-5" />
        Контрагент в ЮрИИст
      </h3>

      <div className="flex items-start gap-3">
        <Avatar name={owner.displayName} image={owner.image} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-semibold text-foreground">
              {owner.displayName}
            </p>
            {verified ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-success-light px-1.5 py-0.5 text-xs font-semibold text-success">
                <ShieldCheck className="h-3 w-3" />
                ИНН подтверждён
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-primary-light px-1.5 py-0.5 text-xs font-semibold text-primary-dark">
                <BadgeCheck className="h-3 w-3" />
                ИНН указан
              </span>
            )}
          </div>
          {owner.headline && (
            <p className="truncate text-sm text-muted">{owner.headline}</p>
          )}
        </div>
      </div>

      {err && <p className="mt-3 text-sm text-danger">{err}</p>}

      <div className="mt-4">
        {owner.connection === "connected" ? (
          <button
            type="button"
            onClick={openConversation}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageSquare className="h-4 w-4" />
            )}
            Написать
          </button>
        ) : owner.connection === "outgoing" || requested ? (
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-muted">
            <Clock className="h-4 w-4" />
            Запрос на связь отправлен — ждём ответа контрагента.
          </p>
        ) : owner.connection === "incoming" ? (
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-warning">
            <Clock className="h-4 w-4" />
            Этот контрагент уже отправил вам запрос — примите его в разделе
            «Сеть».
          </p>
        ) : composing ? (
          <div className="space-y-2">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Короткое сообщение — представьтесь и напишите, по какому вопросу обращаетесь"
              className="w-full resize-y rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={sendRequest}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-dark disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Отправить запрос
              </button>
              <button
                type="button"
                onClick={() => setComposing(false)}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-dark"
          >
            <UserPlus className="h-4 w-4" />
            Связаться с контрагентом
          </button>
        )}
      </div>

      {owner.connection === "none" && !composing && !requested && (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted">
          <Check className="h-3 w-3" />
          Сообщение придёт как запрос на связь — контрагент сможет принять
          или отклонить его.
        </p>
      )}
    </div>
  );
}
