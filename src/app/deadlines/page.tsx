"use client";

// Contract calendar — key dates AI pulled out of analysed contracts,
// grouped by urgency, plus a list of contracts not yet scanned.

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  CalendarClock,
  AlertTriangle,
  FileText,
  Loader2,
  X,
  Search,
  AlertCircle,
} from "lucide-react";

interface Deadline {
  id: string;
  kind: string;
  label: string;
  dueDate: string;
  documentId: string;
  documentName: string;
}

interface ScannableDoc {
  id: string;
  fileName: string;
  createdAt: string;
}

const KIND_LABEL: Record<string, string> = {
  expiry: "Окончание срока",
  renewal: "Пролонгация",
  payment: "Оплата",
  notice: "Уведомление",
  other: "Дата",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function daysUntil(iso: string): number {
  const due = new Date(iso).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due - today.getTime()) / (24 * 60 * 60 * 1000));
}

interface Bucket {
  key: string;
  title: string;
  items: Deadline[];
  danger?: boolean;
}

export default function DeadlinesPage() {
  const [deadlines, setDeadlines] = useState<Deadline[] | null>(null);
  const [scannable, setScannable] = useState<ScannableDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState<string | null>(null);

  function load() {
    fetch("/api/deadlines")
      .then(async (r) => {
        if (!r.ok) {
          setError("Не удалось загрузить сроки");
          return;
        }
        const d = await r.json();
        setDeadlines(d.deadlines);
        setScannable(d.scannableDocuments);
      })
      .catch(() => setError("Сеть недоступна"));
  }

  useEffect(load, []);

  async function scan(documentId: string) {
    setScanning(documentId);
    setError(null);
    try {
      const r = await fetch(`/api/documents/${documentId}/deadlines`, {
        method: "POST",
      });
      if (!r.ok) {
        setError((await r.json()).error ?? "Не удалось распознать сроки");
        return;
      }
      load();
    } finally {
      setScanning(null);
    }
  }

  async function dismiss(id: string) {
    setDeadlines((prev) => (prev ?? []).filter((d) => d.id !== id));
    await fetch(`/api/deadlines/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss" }),
    }).catch(() => undefined);
  }

  const buckets: Bucket[] = [];
  if (deadlines) {
    const overdue: Deadline[] = [];
    const week: Deadline[] = [];
    const month: Deadline[] = [];
    const later: Deadline[] = [];
    for (const d of deadlines) {
      const days = daysUntil(d.dueDate);
      if (days < 0) overdue.push(d);
      else if (days <= 7) week.push(d);
      else if (days <= 31) month.push(d);
      else later.push(d);
    }
    if (overdue.length)
      buckets.push({
        key: "overdue",
        title: "Просрочено",
        items: overdue,
        danger: true,
      });
    if (week.length)
      buckets.push({ key: "week", title: "На этой неделе", items: week });
    if (month.length)
      buckets.push({ key: "month", title: "В этом месяце", items: month });
    if (later.length)
      buckets.push({ key: "later", title: "Позже", items: later });
  }

  return (
    <AppShell>
      <PageHeader
        title="Сроки и напоминания"
        description="Ключевые даты из ваших договоров. За 3 дня до срока придёт письмо-напоминание."
      />
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">

          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-light px-4 py-3 text-sm text-danger"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {deadlines === null && !error && (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted" />
            </div>
          )}

          {deadlines !== null && (
            <div className="space-y-6">
              {buckets.length === 0 && (
                <div className="rounded-xl border border-dashed border-border bg-card py-12 text-center">
                  <CalendarClock className="mx-auto mb-3 h-8 w-8 text-muted/50" />
                  <p className="text-sm text-muted">
                    Отслеживаемых сроков пока нет. Просканируйте договор
                    ниже — AI найдёт ключевые даты.
                  </p>
                </div>
              )}

              {buckets.map((b) => (
                <section key={b.key}>
                  <h2
                    className={`mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider ${
                      b.danger ? "text-danger" : "text-muted"
                    }`}
                  >
                    {b.danger && <AlertTriangle className="h-4 w-4" />}
                    {b.title} ({b.items.length})
                  </h2>
                  <div className="space-y-2">
                    {b.items.map((d) => {
                      const days = daysUntil(d.dueDate);
                      return (
                        <div
                          key={d.id}
                          className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-md bg-surface px-1.5 py-0.5 text-xs font-semibold text-muted">
                                {KIND_LABEL[d.kind] ?? "Дата"}
                              </span>
                              <span className="font-semibold text-foreground">
                                {d.label}
                              </span>
                            </div>
                            <Link
                              href={`/report/${d.documentId}`}
                              className="mt-0.5 flex items-center gap-1 text-xs text-muted transition-colors hover:text-primary"
                            >
                              <FileText className="h-3 w-3" />
                              <span className="truncate">
                                {d.documentName}
                              </span>
                            </Link>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold text-foreground">
                              {formatDate(d.dueDate)}
                            </p>
                            <p
                              className={`text-xs ${
                                days < 0
                                  ? "text-danger"
                                  : days <= 7
                                    ? "text-warning"
                                    : "text-muted"
                              }`}
                            >
                              {days < 0
                                ? `просрочено на ${-days} дн.`
                                : days === 0
                                  ? "сегодня"
                                  : `через ${days} дн.`}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => dismiss(d.id)}
                            aria-label="Убрать напоминание"
                            className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-danger"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}

              {scannable.length > 0 && (
                <section>
                  <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted">
                    Договоры без проверки сроков
                  </h2>
                  <div className="space-y-2">
                    {scannable.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-muted" />
                        <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                          {doc.fileName}
                        </p>
                        <button
                          type="button"
                          onClick={() => scan(doc.id)}
                          disabled={scanning === doc.id}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg transition-colors hover:bg-primary-dark disabled:opacity-50"
                        >
                          {scanning === doc.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Search className="h-3.5 w-3.5" />
                          )}
                          Найти сроки
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </AppShell>
  );
}
