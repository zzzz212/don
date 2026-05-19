"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/app-shell";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  TrendingUp,
  FileSearch,
  FileText,
  MessageCircle,
  Sparkles,
  Crown,
  Zap,
  Trophy,
} from "lucide-react";

interface MemberRow {
  userId: string;
  email: string;
  name: string | null;
  role: string;
  usage: {
    analyze: number;
    generate: number;
    chat: number;
    ocr: number;
  };
  total: number;
}

interface UsageResponse {
  orgId: string;
  periodStart: string;
  periodEnd: string;
  plan: {
    effective: "FREE" | "PRO" | "BUSINESS";
    baseline: "FREE" | "PRO" | "BUSINESS";
    isTrial: boolean;
    trialDaysLeft: number | null;
  };
  quotas: Array<{
    feature: "analyze" | "generate" | "chat" | "ocr";
    used: number;
    limit: number | null;
    unlimited: boolean;
    remaining: number | null;
  }>;
  totals: Record<string, number>;
  members: MemberRow[];
}

const PLAN_LABEL: Record<string, string> = {
  FREE: "Старт",
  PRO_SOLO: "Pro Solo",
  PRO_TEAM: "Pro Team",
  BUSINESS: "Бизнес",
  PRO: "Pro Solo", // legacy
};

const FEATURE_META: Record<
  "analyze" | "generate" | "chat" | "ocr",
  { label: string; icon: typeof FileSearch }
> = {
  analyze: { label: "Анализы договоров", icon: FileSearch },
  generate: { label: "Генерации документов", icon: FileText },
  chat: { label: "Сообщения в чате", icon: MessageCircle },
  ocr: { label: "Распознавание сканов", icon: Sparkles },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function ProgressBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const color =
    pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-primary";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
      <div
        className={`h-full ${color} transition-all`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function OrgUsagePage() {
  const { data: session } = useSession();
  const orgId = session?.user?.activeOrgId;

  const [data, setData] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    fetch(`/api/organizations/${orgId}/usage`)
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 403) {
          setError(
            "Аналитика workspace доступна только администраторам и владельцам."
          );
          return;
        }
        if (!r.ok) {
          setError(`Ошибка ${r.status}`);
          return;
        }
        setData((await r.json()) as UsageResponse);
      })
      .catch(() => !cancelled && setError("Сеть недоступна."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  return (
    <AppShell>
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href="/settings/organization"
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />К настройкам workspace
          </Link>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light">
              <TrendingUp className="h-5 w-5 text-primary-dark" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Использование workspace
              </h1>
              <p className="text-sm text-muted">
                Кто и сколько потратил квоты в этом месяце.
              </p>
            </div>
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
            <div className="space-y-6">
              {/* Plan + period */}
              <section className="rounded-2xl border border-border bg-card p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Тариф
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-primary-light px-2.5 py-1 text-sm font-semibold text-primary-dark">
                        {data.plan.effective === "FREE" ? (
                          <Zap className="h-4 w-4" />
                        ) : (
                          <Crown className="h-4 w-4" />
                        )}
                        {PLAN_LABEL[data.plan.effective] ?? data.plan.effective}
                      </span>
                      {data.plan.isTrial &&
                        typeof data.plan.trialDaysLeft === "number" && (
                          <span className="rounded-md bg-warning-light px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-warning">
                            Триал {data.plan.trialDaysLeft}д
                          </span>
                        )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted">Период</p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      с {formatDate(data.periodStart)}
                    </p>
                  </div>
                </div>
              </section>

              {/* Quota usage */}
              <section className="rounded-2xl border border-border bg-card p-6">
                <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted">
                  Квота в этом месяце
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {data.quotas.map((q) => {
                    const meta = FEATURE_META[q.feature];
                    const Icon = meta.icon;
                    return (
                      <div key={q.feature} className="rounded-xl bg-surface/50 p-4">
                        <div className="mb-2 flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted" />
                          <span className="text-xs font-medium text-muted">
                            {meta.label}
                          </span>
                        </div>
                        {q.unlimited ? (
                          <>
                            <p className="text-xl font-bold text-foreground tabular-nums">
                              {q.used.toLocaleString("ru-RU")}
                            </p>
                            <p className="text-xs text-success">
                              Безлимит
                            </p>
                          </>
                        ) : q.limit === 0 ? (
                          <>
                            <p className="text-sm font-medium text-muted">
                              Недоступно на тарифе
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="mb-2 text-xl font-bold text-foreground tabular-nums">
                              {q.used.toLocaleString("ru-RU")}{" "}
                              <span className="text-sm font-normal text-muted">
                                / {q.limit}
                              </span>
                            </p>
                            <ProgressBar used={q.used} limit={q.limit ?? 1} />
                            <p className="mt-1 text-xs text-muted">
                              Осталось {q.remaining ?? 0}
                            </p>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Per-user breakdown */}
              <section className="rounded-2xl border border-border bg-card p-6">
                <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted">
                  По участникам
                </h2>
                {data.members.length === 0 ? (
                  <p className="text-sm text-muted">
                    Участников ещё нет.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="overflow-x-auto -mx-4 sm:mx-0"><table className="w-full min-w-[640px] text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted">
                          <th className="py-2 pr-3">Участник</th>
                          <th className="py-2 pr-3">Роль</th>
                          <th className="py-2 pr-3 text-right">Анализы</th>
                          <th className="py-2 pr-3 text-right">Генерации</th>
                          <th className="py-2 pr-3 text-right">Чат</th>
                          <th className="py-2 pr-3 text-right">OCR</th>
                          <th className="py-2 pr-3 text-right">Всего</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.members.map((m, i) => (
                          <tr
                            key={m.userId}
                            className="border-b border-border last:border-0"
                          >
                            <td className="py-3 pr-3">
                              <div className="flex items-center gap-2">
                                {i === 0 && m.total > 0 && (
                                  <Trophy className="h-3.5 w-3.5 shrink-0 text-warning" />
                                )}
                                <div>
                                  <div className="font-medium text-foreground">
                                    {m.email}
                                  </div>
                                  {m.name && (
                                    <div className="text-xs text-muted">
                                      {m.name}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 pr-3">
                              <span className="rounded-md bg-surface px-2 py-0.5 text-xs font-semibold text-muted">
                                {m.role}
                              </span>
                            </td>
                            <td className="py-3 pr-3 text-right tabular-nums text-foreground">
                              {m.usage.analyze.toLocaleString("ru-RU")}
                            </td>
                            <td className="py-3 pr-3 text-right tabular-nums text-foreground">
                              {m.usage.generate.toLocaleString("ru-RU")}
                            </td>
                            <td className="py-3 pr-3 text-right tabular-nums text-foreground">
                              {m.usage.chat.toLocaleString("ru-RU")}
                            </td>
                            <td className="py-3 pr-3 text-right tabular-nums text-foreground">
                              {m.usage.ocr.toLocaleString("ru-RU")}
                            </td>
                            <td className="py-3 pr-3 text-right tabular-nums font-bold text-foreground">
                              {m.total.toLocaleString("ru-RU")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-surface/50 font-semibold">
                          <td className="py-3 pr-3 text-foreground">Итого</td>
                          <td />
                          <td className="py-3 pr-3 text-right tabular-nums text-foreground">
                            {(data.totals.analyze ?? 0).toLocaleString(
                              "ru-RU"
                            )}
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums text-foreground">
                            {(data.totals.generate ?? 0).toLocaleString(
                              "ru-RU"
                            )}
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums text-foreground">
                            {(data.totals.chat ?? 0).toLocaleString("ru-RU")}
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums text-foreground">
                            {(data.totals.ocr ?? 0).toLocaleString("ru-RU")}
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums text-foreground">
                            {(
                              (data.totals.analyze ?? 0) +
                              (data.totals.generate ?? 0) +
                              (data.totals.chat ?? 0) +
                              (data.totals.ocr ?? 0)
                            ).toLocaleString("ru-RU")}
                          </td>
                        </tr>
                      </tfoot>
                    </table></div>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </AppShell>
  );
}
