"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
import {
  Users,
  Building2,
  Crown,
  TrendingUp,
  CreditCard,
  FileSearch,
  FileText,
  MessageCircle,
  AlertCircle,
  Sparkles,
  Loader2,
  ArrowRight,
} from "lucide-react";

interface AdminStats {
  generatedAt: string;
  users: {
    total: number;
    newLast7d: number;
    newLast30d: number;
  };
  organizations: {
    total: number;
    byPlan: Record<string, number>;
    activeTrials: number;
  };
  revenue: {
    mrrRub: number;
    totalRub: number;
    totalPaymentsCount: number;
    paymentsLast30d: number;
    activeSubscriptions: number;
  };
  usageThisMonth: {
    analyses: number;
    generates: number;
    chats: number;
  };
}

function formatRub(rub: number): string {
  return new Intl.NumberFormat("ru-RU").format(rub);
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n);
}

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Users;
  accent?: "primary" | "success" | "warning" | "muted";
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "muted",
}: StatCardProps) {
  const accentClass =
    accent === "primary"
      ? "bg-primary-light text-primary-dark"
      : accent === "success"
        ? "bg-success/10 text-success"
        : accent === "warning"
          ? "bg-warning-light text-warning"
          : "bg-surface text-muted";
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">
            {value}
          </p>
          {hint && (
            <p className="mt-1 text-xs text-muted truncate">{hint}</p>
          )}
        </div>
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accentClass}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/stats")
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 403) {
          setError(
            "Доступ запрещён. Эта страница доступна только администраторам."
          );
          return;
        }
        if (r.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (!r.ok) {
          setError(`Не удалось загрузить статистику (${r.status})`);
          return;
        }
        setStats((await r.json()) as AdminStats);
      })
      .catch(() => setError("Сеть недоступна."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main id="main-content" className="flex-1 bg-surface/30">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Внутренний инструмент
              </p>
              <h1 className="mt-1 text-2xl font-bold text-foreground">
                Админ-панель
              </h1>
              <p className="mt-1 text-sm text-muted">
                Общая статистика по проекту. Данные обновляются при
                перезагрузке.
              </p>
            </div>
            <nav className="flex flex-wrap gap-2">
              <Link
                href="/admin/users"
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
              >
                <Users className="h-4 w-4" />
                Пользователи
              </Link>
              <Link
                href="/admin/orgs"
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
              >
                <Building2 className="h-4 w-4" />
                Workspaces
              </Link>
              <Link
                href="/admin/payments"
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
              >
                <CreditCard className="h-4 w-4" />
                Платежи
              </Link>
            </nav>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted" />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-light px-4 py-3 text-sm text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {stats && (
            <div className="space-y-8">
              {/* Users + Workspaces */}
              <section>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">
                  Аккаунты и workspaces
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard
                    label="Всего пользователей"
                    value={formatNumber(stats.users.total)}
                    hint={`+${stats.users.newLast7d} за неделю · +${stats.users.newLast30d} за месяц`}
                    icon={Users}
                    accent="primary"
                  />
                  <StatCard
                    label="Всего workspaces"
                    value={formatNumber(stats.organizations.total)}
                    hint={`FREE ${stats.organizations.byPlan.FREE ?? 0} · PRO ${stats.organizations.byPlan.PRO ?? 0} · BIZ ${stats.organizations.byPlan.BUSINESS ?? 0}`}
                    icon={Building2}
                    accent="muted"
                  />
                  <StatCard
                    label="Активных триалов"
                    value={formatNumber(stats.organizations.activeTrials)}
                    hint="Workspaces сейчас на пробном «Про»"
                    icon={Sparkles}
                    accent="warning"
                  />
                  <StatCard
                    label="Активных подписок"
                    value={formatNumber(stats.revenue.activeSubscriptions)}
                    hint="Платящие workspaces"
                    icon={Crown}
                    accent="success"
                  />
                </div>
              </section>

              {/* Revenue */}
              <section>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">
                  Выручка
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard
                    label="MRR"
                    value={`${formatRub(stats.revenue.mrrRub)} ₽`}
                    hint="Месячная регулярная выручка"
                    icon={TrendingUp}
                    accent="success"
                  />
                  <StatCard
                    label="Всего получено"
                    value={`${formatRub(stats.revenue.totalRub)} ₽`}
                    hint={`${formatNumber(stats.revenue.totalPaymentsCount)} платежей`}
                    icon={CreditCard}
                    accent="primary"
                  />
                  <StatCard
                    label="Платежей за 30 дней"
                    value={formatNumber(stats.revenue.paymentsLast30d)}
                    hint="Только успешные"
                    icon={CreditCard}
                    accent="muted"
                  />
                  <Link
                    href="/admin/payments"
                    className="group flex items-center justify-between rounded-2xl border border-dashed border-border bg-card p-5 transition-colors hover:border-primary hover:bg-primary-light/30"
                  >
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                        Все платежи →
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        История с фильтрами
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </Link>
                </div>
              </section>

              {/* Usage */}
              <section>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">
                  Использование (этот месяц)
                </h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  <StatCard
                    label="Анализы договоров"
                    value={formatNumber(stats.usageThisMonth.analyses)}
                    icon={FileSearch}
                    accent="primary"
                  />
                  <StatCard
                    label="Генерации документов"
                    value={formatNumber(stats.usageThisMonth.generates)}
                    icon={FileText}
                    accent="primary"
                  />
                  <StatCard
                    label="Сообщения в чате"
                    value={formatNumber(stats.usageThisMonth.chats)}
                    icon={MessageCircle}
                    accent="primary"
                  />
                </div>
              </section>

              <p className="text-xs text-muted">
                Сгенерировано:{" "}
                {new Date(stats.generatedAt).toLocaleString("ru-RU")}
              </p>
            </div>
          )}
        </div>
      </main>
      <Disclaimer />
    </div>
  );
}
