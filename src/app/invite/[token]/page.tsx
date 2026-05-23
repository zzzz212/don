"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Header } from "@/components/header";
import {
  Building2,
  Crown,
  Shield,
  User as UserIcon,
  Loader2,
  AlertTriangle,
  CheckCircle,
  LogIn,
} from "lucide-react";

interface InvitePreview {
  organization: { id: string; name: string };
  role: "OWNER" | "ADMIN" | "MEMBER";
  email: string | null;
  expiresAt: string;
}

const ROLE_META = {
  OWNER: { label: "Владелец", icon: Crown },
  ADMIN: { label: "Админ", icon: Shield },
  MEMBER: { label: "Участник", icon: UserIcon },
};

export default function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const { data: session, status, update } = useSession();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // Load invite preview on mount.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/invites/${token}`)
      .then(async (r) => {
        const json = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setError(json.error ?? "Не удалось загрузить приглашение");
        } else {
          setPreview(json);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Сеть недоступна");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const res = await fetch(`/api/invites/${token}/accept`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setAccepted(true);
        // Refresh JWT in the background so the cookie carries the new
        // activeOrgId by the time the navigation below sends it. Without
        // this, the user would land on /dashboard with a stale cookie
        // pointing at the previous workspace.
        update().catch(() => undefined);
        // Brief pause for the success state to be visible, then hard
        // reload so every workspace-scoped query re-initialises cleanly.
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 800);
      } else {
        setError(data.error ?? "Не удалось принять приглашение");
        setAccepting(false);
      }
    } catch {
      setError("Сеть недоступна");
      setAccepting(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <Header />

      <main id="main-content" className="flex-1 bg-surface/30">
        <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted">Загружаем приглашение…</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-danger/30 bg-danger-light p-8 text-center">
              <AlertTriangle className="mx-auto h-10 w-10 text-danger" />
              <h1 className="mt-4 text-lg font-bold text-foreground">
                Не получилось
              </h1>
              <p className="mt-2 text-sm text-muted">{error}</p>
              <Link
                href="/dashboard"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
              >
                В дашборд
              </Link>
            </div>
          ) : accepted ? (
            <div className="rounded-2xl border border-success/30 bg-success-light p-8 text-center">
              <CheckCircle className="mx-auto h-10 w-10 text-success" />
              <h1 className="mt-4 text-lg font-bold text-foreground">
                Добро пожаловать!
              </h1>
              <p className="mt-2 text-sm text-muted">
                Переключаем вас в новый workspace…
              </p>
            </div>
          ) : preview ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-light">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <h1 className="mt-4 text-xl font-bold text-foreground">
                Приглашение в workspace
              </h1>
              <p className="mt-2 text-sm text-muted">
                Вас приглашают присоединиться к команде
              </p>

              <div className="mt-6 rounded-xl bg-surface px-4 py-4">
                <p className="text-lg font-semibold text-foreground">
                  {preview.organization.name}
                </p>
                {(() => {
                  const meta = ROLE_META[preview.role];
                  const Icon = meta.icon;
                  return (
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-muted">
                      <Icon className="h-3.5 w-3.5" />
                      Роль: {meta.label}
                    </p>
                  );
                })()}
              </div>

              {status === "loading" ? (
                <div className="mt-6 flex justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : !session?.user ? (
                <Link
                  href={`/login?callbackUrl=${encodeURIComponent(
                    `/invite/${token}`
                  )}`}
                  className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
                >
                  <LogIn className="h-4 w-4" />
                  Войти и принять
                </Link>
              ) : (
                <div className="mt-6 space-y-2">
                  <button
                    onClick={handleAccept}
                    disabled={accepting}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
                  >
                    {accepting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    Принять приглашение
                  </button>
                  <p className="text-xs text-muted">
                    Вошли как {session.user.email}
                  </p>
                </div>
              )}

              <p className="mt-6 text-xs text-muted">
                Срок действия:{" "}
                {new Date(preview.expiresAt).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
