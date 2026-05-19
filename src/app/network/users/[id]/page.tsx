"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  UserPlus,
  Check,
  X,
  Clock,
  MessageSquare,
  Briefcase,
} from "lucide-react";

type ConnState =
  | "none"
  | "connected"
  | "incoming"
  | "outgoing"
  | "declined";

interface Profile {
  userId: string;
  isSelf: boolean;
  displayName: string;
  headline: string | null;
  bio: string | null;
  specialization: string | null;
  image: string | null;
  connection: ConnState;
  connectionId: string | null;
}

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void load();
  }, [id]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/network/users/${id}`);
      if (!r.ok) {
        setError(
          r.status === 404
            ? "Профиль не найден или скрыт из каталога."
            : "Не удалось загрузить профиль."
        );
        return;
      }
      setProfile(await r.json());
    } catch {
      setError("Не удалось загрузить профиль.");
    } finally {
      setLoading(false);
    }
  }

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/network/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: id }),
      });
      if (r.ok) await load();
      else setError((await r.json()).error ?? "Не удалось отправить запрос.");
    } finally {
      setBusy(false);
    }
  }

  async function respond(action: "accept" | "decline") {
    if (!profile?.connectionId) return;
    setBusy(true);
    try {
      const r = await fetch(
        `/api/network/connections/${profile.connectionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      if (r.ok) await load();
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!profile?.connectionId) return;
    setBusy(true);
    try {
      const r = await fetch(
        `/api/network/connections/${profile.connectionId}`,
        { method: "DELETE" }
      );
      if (r.ok) await load();
    } finally {
      setBusy(false);
    }
  }

  async function message() {
    setBusy(true);
    try {
      const r = await fetch("/api/network/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: id }),
      });
      if (r.ok) {
        const { conversationId } = await r.json();
        router.push(`/network/messages/${conversationId}`);
      } else {
        setError((await r.json()).error ?? "Не удалось открыть переписку.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
          <Loader2 className="h-8 w-8 animate-spin text-muted" />
        </AppShell>
    );
  }

  if (error || !profile) {
    return (
      <AppShell>
          <div className="text-center">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-warning" />
            <p className="mb-4 text-muted">{error ?? "Профиль не найден"}</p>
            <Link
              href="/network"
              className="text-sm font-semibold text-primary hover:underline"
            >
              К сети
            </Link>
          </div>
        </AppShell>
    );
  }

  const initials = profile.displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href="/network"
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />К сети
          </Link>

          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-fg">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold text-foreground">
                  {profile.displayName}
                </h1>
                {profile.headline && (
                  <p className="mt-0.5 text-sm text-muted">
                    {profile.headline}
                  </p>
                )}
                {profile.connection === "connected" && (
                  <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-success-light px-2 py-0.5 text-xs font-semibold text-success">
                    <Check className="h-3 w-3" />
                    Вы связаны
                  </span>
                )}
              </div>
            </div>

            {profile.specialization && (
              <div className="mt-5">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  <Briefcase className="h-3.5 w-3.5" />
                  Специализация
                </p>
                <p className="text-sm text-foreground">
                  {profile.specialization}
                </p>
              </div>
            )}

            {profile.bio && (
              <div className="mt-5">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  О себе
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {profile.bio}
                </p>
              </div>
            )}

            {/* Actions */}
            {!profile.isSelf && (
              <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
                {profile.connection === "connected" && (
                  <button
                    type="button"
                    onClick={message}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-dark disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MessageSquare className="h-4 w-4" />
                    )}
                    Написать
                  </button>
                )}
                {(profile.connection === "none" ||
                  profile.connection === "declined") && (
                  <button
                    type="button"
                    onClick={connect}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-dark disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                    Связаться
                  </button>
                )}
                {profile.connection === "outgoing" && (
                  <>
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-surface px-4 py-2.5 text-sm font-semibold text-muted">
                      <Clock className="h-4 w-4" />
                      Запрос отправлен
                    </span>
                    <button
                      type="button"
                      onClick={cancel}
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-foreground disabled:opacity-50"
                    >
                      Отменить
                    </button>
                  </>
                )}
                {profile.connection === "incoming" && (
                  <>
                    <button
                      type="button"
                      onClick={() => respond("accept")}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-dark disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      Принять запрос
                    </button>
                    <button
                      type="button"
                      onClick={() => respond("decline")}
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-foreground disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                      Отклонить
                    </button>
                  </>
                )}
              </div>
            )}

            {profile.isSelf && (
              <div className="mt-6 border-t border-border pt-5">
                <Link
                  href="/network"
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  Это вы. Редактировать профиль во вкладке «Мой профиль» →
                </Link>
              </div>
            )}
          </div>
        </div>
      </AppShell>
  );
}
