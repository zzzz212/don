"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
import {
  Search,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  Crown,
  Zap,
  Building2,
} from "lucide-react";

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  trialEndsAt: string | null;
  onActiveTrial: boolean;
  createdAt: string;
  memberCount: number;
  documentCount: number;
  owner: { id: string; email: string; name: string | null } | null;
  subscription: {
    plan: string;
    status: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null;
}

interface OrgsResponse {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  orgs: OrgRow[];
}

const PLAN_CHIP: Record<string, { label: string; cls: string; icon: typeof Zap }> = {
  FREE: { label: "Старт", cls: "bg-surface text-muted", icon: Zap },
  PRO: {
    label: "Про",
    cls: "bg-primary-light text-primary-dark",
    icon: Crown,
  },
  BUSINESS: {
    label: "Бизнес",
    cls: "bg-amber-100 text-amber-800",
    icon: Crown,
  },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function OrgsPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [planFilter, setPlanFilter] = useState(params.get("plan") ?? "");
  const [page, setPage] = useState(
    Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1)
  );

  const [data, setData] = useState<OrgsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (planFilter) u.set("plan", planFilter);
    if (page > 1) u.set("page", String(page));
    const qs = u.toString();
    router.replace(qs ? `/admin/orgs?${qs}` : "/admin/orgs", { scroll: false });
  }, [q, planFilter, page, router]);

  useEffect(() => setPage(1), [q, planFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (planFilter) u.set("plan", planFilter);
    if (page > 1) u.set("page", String(page));
    fetch(`/api/admin/orgs?${u.toString()}`)
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
        setData((await r.json()) as OrgsResponse);
      })
      .catch(() => !cancelled && setError("Сеть недоступна."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [q, planFilter, page]);

  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main className="flex-1 bg-surface/30">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href="/admin"
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />К админ-панели
          </Link>
          <h1 className="mb-1 text-2xl font-bold text-foreground">Workspaces</h1>
          <p className="mb-6 text-sm text-muted">
            {data
              ? `${data.total.toLocaleString("ru-RU")} рабочих пространств`
              : "Загрузка…"}
          </p>

          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Название, slug или email владельца"
                className="w-full rounded-xl border border-border bg-white py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              <option value="">Все тарифы</option>
              <option value="FREE">Старт</option>
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
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {data && !loading && (
            <>
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface/50 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                      <th className="px-4 py-3">Название</th>
                      <th className="px-4 py-3">Владелец</th>
                      <th className="px-4 py-3">Тариф</th>
                      <th className="px-4 py-3 text-right">Участники</th>
                      <th className="px-4 py-3 text-right">Документы</th>
                      <th className="px-4 py-3">Создан</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orgs.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-12 text-center text-muted"
                        >
                          Workspaces по фильтрам не найдены.
                        </td>
                      </tr>
                    )}
                    {data.orgs.map((o) => {
                      const planChip = PLAN_CHIP[o.plan] ?? PLAN_CHIP.FREE;
                      const PlanIcon = planChip.icon;
                      return (
                        <tr
                          key={o.id}
                          className="border-b border-border last:border-0 hover:bg-surface/40"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted" />
                              <span className="font-medium text-foreground">
                                {o.name}
                              </span>
                            </div>
                            <p className="ml-6 mt-0.5 text-xs text-muted">
                              {o.slug}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            {o.owner ? (
                              <Link
                                href={`/admin/users/${o.owner.id}`}
                                className="font-medium text-foreground hover:underline"
                              >
                                {o.owner.email}
                              </Link>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${planChip.cls}`}
                              >
                                <PlanIcon className="h-3 w-3" />
                                {planChip.label}
                              </span>
                              {o.onActiveTrial && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                  <Sparkles className="h-3 w-3" />
                                  Триал
                                </span>
                              )}
                              {o.subscription?.cancelAtPeriodEnd && (
                                <span className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                                  Отменена
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-foreground">
                            {o.memberCount}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-foreground">
                            {o.documentCount.toLocaleString("ru-RU")}
                          </td>
                          <td className="px-4 py-3 text-muted">
                            {formatDate(o.createdAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
                      className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:opacity-50"
                    >
                      ← Назад
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPage((p) => Math.min(data.pageCount, p + 1))
                      }
                      disabled={data.page >= data.pageCount}
                      className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:opacity-50"
                    >
                      Вперёд →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Disclaimer />
    </div>
  );
}

export default function AdminOrgsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full flex-col">
          <Header />
          <main className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted" />
          </main>
        </div>
      }
    >
      <OrgsPageInner />
    </Suspense>
  );
}
