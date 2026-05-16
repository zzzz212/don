"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  BadgeCheck,
  FileText,
  Check,
  X,
} from "lucide-react";

interface InnClaim {
  userId: string;
  email: string;
  name: string | null;
  inn: string;
  companyName: string | null;
  documentUrl: string;
  claimedAt: string | null;
  submittedAt: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminInnClaimsPage() {
  const [claims, setClaims] = useState<InnClaim[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");

  function load() {
    fetch("/api/admin/inn-claims")
      .then(async (r) => {
        if (r.status === 403) {
          setError("Доступ запрещён. Страница только для администраторов.");
          return;
        }
        if (!r.ok) {
          setError(`Не удалось загрузить заявки (${r.status})`);
          return;
        }
        setClaims((await r.json()).claims as InnClaim[]);
      })
      .catch(() => setError("Сеть недоступна."));
  }

  useEffect(load, []);

  async function resolve(
    userId: string,
    action: "verify" | "reject",
    rejectNote?: string
  ) {
    setBusy(userId);
    setError(null);
    try {
      const r = await fetch(`/api/admin/inn-claims/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: rejectNote }),
      });
      if (!r.ok) {
        setError((await r.json()).error ?? "Не удалось обработать заявку");
        return;
      }
      setClaims((prev) => (prev ?? []).filter((c) => c.userId !== userId));
      setRejecting(null);
      setNote("");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main id="main-content" className="flex-1 bg-surface/30">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href="/admin"
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />К админ-панели
          </Link>
          <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-foreground">
            <BadgeCheck className="h-6 w-6 text-primary" />
            Подтверждение ИНН
          </h1>
          <p className="mb-6 text-sm text-muted">
            Заявки пользователей с загруженной выпиской ЕГРЮЛ/ЕГРИП. Откройте
            документ, сверьте организацию и подтвердите либо отклоните с
            причиной.
          </p>

          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-light px-4 py-3 text-sm text-danger"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {claims === null && !error && (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted" />
            </div>
          )}

          {claims !== null && claims.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card py-16 text-center">
              <BadgeCheck className="mx-auto mb-3 h-8 w-8 text-muted/50" />
              <p className="text-sm text-muted">
                Очередь пуста — все заявки на подтверждение ИНН обработаны.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {(claims ?? []).map((c) => (
              <div
                key={c.userId}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">
                      {c.companyName ?? "Название не определено"}
                    </p>
                    <p className="text-sm text-muted">
                      ИНН {c.inn} · {c.email}
                      {c.name ? ` · ${c.name}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      Заявка от {formatDate(c.submittedAt)}
                    </p>
                  </div>
                  <a
                    href={c.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-card"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Открыть выписку
                  </a>
                </div>

                {rejecting === c.userId ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      maxLength={500}
                      placeholder="Причина отклонения — увидит пользователь"
                      className="w-full resize-y rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy === c.userId || note.trim().length === 0}
                        onClick={() => resolve(c.userId, "reject", note)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
                      >
                        {busy === c.userId ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                        Отклонить
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejecting(null);
                          setNote("");
                        }}
                        className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={busy === c.userId}
                      onClick={() => resolve(c.userId, "verify")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg transition-colors hover:bg-primary-dark disabled:opacity-50"
                    >
                      {busy === c.userId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Подтвердить
                    </button>
                    <button
                      type="button"
                      disabled={busy === c.userId}
                      onClick={() => {
                        setRejecting(c.userId);
                        setNote("");
                      }}
                      className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface hover:text-foreground disabled:opacity-50"
                    >
                      Отклонить…
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
      <Disclaimer />
    </div>
  );
}
