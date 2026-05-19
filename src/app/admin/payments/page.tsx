"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  Search,
  Loader2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";

interface PaymentRow {
  id: string;
  plan: string;
  amountRub: number;
  currency: string;
  status: string;
  failureReason: string | null;
  createdAt: string;
  succeededAt: string | null;
  customerEmail: string;
  providerPaymentId: string | null;
  user: { id: string; email: string; name: string | null } | null;
  org: { id: string; name: string } | null;
}

interface PaymentsResponse {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  filteredRevenue: { succeededRub: number; succeededCount: number };
  payments: PaymentRow[];
}

const PLAN_LABEL: Record<string, string> = {
  PRO_SOLO: "Pro Solo",
  PRO_TEAM: "Pro Team",
  BUSINESS: "Бизнес",
  PRO: "Pro Solo", // legacy
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    SUCCEEDED: { label: "Оплачено", cls: "bg-success/10 text-success" },
    PENDING: { label: "Ожидает", cls: "bg-warning-light text-warning" },
    WAITING_FOR_CAPTURE: {
      label: "Ожидает захвата",
      cls: "bg-warning-light text-warning",
    },
    CANCELED: { label: "Отменён", cls: "bg-surface text-muted" },
    FAILED: { label: "Ошибка", cls: "bg-danger-light text-danger" },
  };
  const e = map[status] ?? { label: status, cls: "bg-surface text-muted" };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${e.cls}`}
    >
      {e.label}
    </span>
  );
}

function PaymentsPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState(params.get("status") ?? "");
  const [planFilter, setPlanFilter] = useState(params.get("plan") ?? "");
  const [page, setPage] = useState(
    Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1)
  );

  const [data, setData] = useState<PaymentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (statusFilter) u.set("status", statusFilter);
    if (planFilter) u.set("plan", planFilter);
    if (page > 1) u.set("page", String(page));
    const qs = u.toString();
    router.replace(qs ? `/admin/payments?${qs}` : "/admin/payments", {
      scroll: false,
    });
  }, [q, statusFilter, planFilter, page, router]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (statusFilter) u.set("status", statusFilter);
    if (planFilter) u.set("plan", planFilter);
    if (page > 1) u.set("page", String(page));
    fetch(`/api/admin/payments?${u.toString()}`)
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 403) {
          setError("Доступ запрещён.");
          return;
        }
        if (!r.ok) {
          setError(`Ошибка ${r.status}`);
          return;
        }
        setData((await r.json()) as PaymentsResponse);
      })
      .catch(() => !cancelled && setError("Сеть недоступна."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [q, statusFilter, planFilter, page]);

  return (
    <AppShell>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href="/admin"
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />К админ-панели
          </Link>
          <h1 className="mb-1 text-2xl font-bold text-foreground">Платежи</h1>
          {data && (
            <p className="mb-6 text-sm text-muted">
              {data.total.toLocaleString("ru-RU")} платежей · оплачено по
              фильтру: {data.filteredRevenue.succeededRub.toLocaleString("ru-RU")}{" "}
              ₽ ({data.filteredRevenue.succeededCount.toLocaleString("ru-RU")})
            </p>
          )}

          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Email или имя пользователя"
                className="w-full rounded-xl border border-border bg-card py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              <option value="">Любой статус</option>
              <option value="SUCCEEDED">Оплачено</option>
              <option value="PENDING">Ожидает</option>
              <option value="CANCELED">Отменено</option>
              <option value="FAILED">Ошибка</option>
            </select>
            <select
              value={planFilter}
              onChange={(e) => {
                setPlanFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              <option value="">Любой тариф</option>
              <option value="PRO">Про</option>
              <option value="BUSINESS">Бизнес</option>
            </select>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted" />
            </div>
          )}

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-light px-4 py-3 text-sm text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {data && !loading && (
            <>
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="overflow-x-auto -mx-4 sm:mx-0"><table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface/50 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                      <th className="px-4 py-3">Дата</th>
                      <th className="px-4 py-3">Пользователь</th>
                      <th className="px-4 py-3">Workspace</th>
                      <th className="px-4 py-3">Тариф</th>
                      <th className="px-4 py-3">Сумма</th>
                      <th className="px-4 py-3">Статус</th>
                      <th className="px-4 py-3">ЮKassa ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-12 text-center text-muted"
                        >
                          Платежей по этим фильтрам нет.
                        </td>
                      </tr>
                    )}
                    {data.payments.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-border last:border-0 hover:bg-surface/40"
                      >
                        <td className="px-4 py-3 text-muted">
                          {formatDateTime(p.succeededAt ?? p.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          {p.user ? (
                            <Link
                              href={`/admin/users/${p.user.id}`}
                              className="font-medium text-foreground hover:underline"
                            >
                              {p.user.email}
                            </Link>
                          ) : (
                            <span className="text-muted">{p.customerEmail}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {p.org?.name ?? <span className="text-muted">—</span>}
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {PLAN_LABEL[p.plan] ?? p.plan}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-foreground">
                          {p.amountRub.toLocaleString("ru-RU")} ₽
                        </td>
                        <td className="px-4 py-3">
                          <StatusChip status={p.status} />
                          {p.failureReason && (
                            <p className="mt-1 text-xs text-danger">
                              {p.failureReason}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted">
                          {p.providerPaymentId ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </div>

              {data.pageCount > 1 && (
                <div className="mt-4 flex items-center justify-between text-sm text-muted">
                  <p>
                    Страница {data.page} из {data.pageCount}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={data.page <= 1}
                      className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:opacity-50"
                    >
                      ← Назад
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPage((p) => Math.min(data.pageCount, p + 1))
                      }
                      disabled={data.page >= data.pageCount}
                      className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:opacity-50"
                    >
                      Вперёд →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </AppShell>
  );
}

export default function AdminPaymentsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
            <Loader2 className="h-8 w-8 animate-spin text-muted" />
          </AppShell>
      }
    >
      <PaymentsPageInner />
    </Suspense>
  );
}
