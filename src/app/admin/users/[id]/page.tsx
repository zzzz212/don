"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { useToast } from "@/components/toast";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Sparkles,
  Crown,
  Zap,
  Calendar,
  CreditCard,
  Building2,
  ShieldCheck,
} from "lucide-react";

interface MembershipInfo {
  role: string;
  org: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    trialEndsAt: string | null;
    createdAt: string;
    memberCount: number;
    subscription: {
      plan: string;
      status: string;
      currentPeriodEnd: string;
      cancelAtPeriodEnd: boolean;
    } | null;
  };
}

interface UserDetail {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
  activeOrgId: string | null;
  trialActivatedAt: string | null;
  legacyPlan: string;
  authProviders: string[];
  counters: {
    documents: number;
    generatedDocuments: number;
    chats: number;
  };
  usageThisMonth: {
    analyze: number;
    generate: number;
    chat: number;
    ocr: number;
  };
  memberships: MembershipInfo[];
  recentPayments: Array<{
    id: string;
    plan: string;
    amountRub: number;
    status: string;
    createdAt: string;
    succeededAt: string | null;
    failureReason: string | null;
  }>;
}

// Plan tier label set kept in sync with src/lib/legal-info.ts PLAN_LABEL.
// We mirror it locally rather than import to avoid pulling a server-only
// module into this "use client" page.
type AdminPlanCode = "FREE" | "PRO_SOLO" | "PRO_TEAM" | "BUSINESS";

const PLAN_LABEL: Record<string, string> = {
  FREE: "Старт",
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function PaymentStatus({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    SUCCEEDED: { label: "Оплачено", cls: "bg-success/10 text-success" },
    PENDING: { label: "Ожидает", cls: "bg-warning-light text-warning" },
    WAITING_FOR_CAPTURE: { label: "Ожидает захвата", cls: "bg-warning-light text-warning" },
    CANCELED: { label: "Отменён", cls: "bg-surface text-muted" },
    FAILED: { label: "Ошибка", cls: "bg-danger-light text-danger" },
  };
  const e = map[status] ?? { label: status, cls: "bg-surface text-muted" };
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${e.cls}`}>
      {e.label}
    </span>
  );
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const userId = params.id as string;
  const toast = useToast();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    fetch(`/api/admin/users/${userId}`)
      .then(async (r) => {
        if (r.status === 403) {
          setError("Доступ запрещён.");
          return;
        }
        if (r.status === 404) {
          setError("Пользователь не найден.");
          return;
        }
        if (!r.ok) {
          setError(`Ошибка ${r.status}`);
          return;
        }
        setUser((await r.json()) as UserDetail);
        setError(null);
      })
      .catch(() => setError("Сеть недоступна."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleExtendTrial = async (orgId: string, days: number) => {
    setActing(`trial-${orgId}`);
    try {
      const r = await fetch(`/api/admin/users/${userId}/extend-trial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, days }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(json.error ?? "Не удалось продлить триал.");
        return;
      }
      toast.success(
        `Триал продлён на ${days} ${days === 1 ? "день" : "дней"}. До ${formatDate(json.trialEndsAt)}.`
      );
      reload();
    } finally {
      setActing(null);
    }
  };

  const handleChangePlan = async (
    orgId: string,
    plan: AdminPlanCode
  ) => {
    if (
      !confirm(
        `Сменить тариф workspace на «${PLAN_LABEL[plan]}»? Действие не оформляет платёж — это служебная установка тарифа.`
      )
    ) {
      return;
    }
    setActing(`plan-${orgId}`);
    try {
      const r = await fetch(`/api/admin/users/${userId}/change-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, plan, periodMonths: 1 }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(json.error ?? "Не удалось изменить тариф.");
        return;
      }
      toast.success(`Тариф изменён на «${PLAN_LABEL[plan]}».`);
      reload();
    } finally {
      setActing(null);
    }
  };

  return (
    <AppShell>
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href="/admin/users"
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />К списку пользователей
          </Link>

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

          {user && !loading && (
            <div className="space-y-6">
              {/* Profile card */}
              <section className="rounded-2xl border border-border bg-card p-6">
                <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h1 className="text-xl font-bold text-foreground">
                    {user.email}
                  </h1>
                  {user.name && (
                    <span className="text-sm text-muted">({user.name})</span>
                  )}
                </div>
                <div className="grid gap-3 text-sm text-muted sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider">
                      Регистрация
                    </p>
                    <p className="mt-0.5 text-foreground">
                      {formatDateTime(user.createdAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider">
                      Триал использован
                    </p>
                    <p className="mt-0.5 text-foreground">
                      {user.trialActivatedAt
                        ? formatDateTime(user.trialActivatedAt)
                        : "Не активирован"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider">
                      Способы входа
                    </p>
                    <p className="mt-0.5 text-foreground">
                      {[
                        ...user.authProviders,
                        user.authProviders.length === 0 ? "credentials" : null,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider">
                      User ID
                    </p>
                    <p className="mt-0.5 truncate font-mono text-xs text-muted">
                      {user.id}
                    </p>
                  </div>
                </div>
              </section>

              {/* Usage this month */}
              <section className="rounded-2xl border border-border bg-card p-6">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">
                  Использование (этот месяц)
                </h2>
                <div className="grid gap-3 sm:grid-cols-4">
                  <UsageStat label="Анализы" value={user.usageThisMonth.analyze} />
                  <UsageStat
                    label="Генерации"
                    value={user.usageThisMonth.generate}
                  />
                  <UsageStat label="Чат" value={user.usageThisMonth.chat} />
                  <UsageStat label="OCR" value={user.usageThisMonth.ocr} />
                </div>
                <p className="mt-3 text-xs text-muted">
                  Всего за всё время: документов{" "}
                  {user.counters.documents.toLocaleString("ru-RU")}, шаблонов{" "}
                  {user.counters.generatedDocuments.toLocaleString("ru-RU")},
                  чатов {user.counters.chats.toLocaleString("ru-RU")}
                </p>
              </section>

              {/* Workspaces */}
              <section className="rounded-2xl border border-border bg-card p-6">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted">
                  <Building2 className="h-4 w-4" />
                  Workspaces ({user.memberships.length})
                </h2>
                {user.memberships.length === 0 && (
                  <p className="text-sm text-muted">
                    Не состоит ни в одном workspace.
                  </p>
                )}
                <div className="space-y-3">
                  {user.memberships.map((m) => (
                    <WorkspaceCard
                      key={m.org.id}
                      membership={m}
                      isOwner={m.role === "OWNER"}
                      acting={acting}
                      onExtendTrial={(days) => handleExtendTrial(m.org.id, days)}
                      onChangePlan={(plan) => handleChangePlan(m.org.id, plan)}
                    />
                  ))}
                </div>
              </section>

              {/* Recent payments */}
              {user.recentPayments.length > 0 && (
                <section className="rounded-2xl border border-border bg-card p-6">
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted">
                    <CreditCard className="h-4 w-4" />
                    Платежи (последние 30 дней)
                  </h2>
                  <div className="overflow-x-auto -mx-4 sm:mx-0"><table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted">
                        <th className="py-2 pr-3">Дата</th>
                        <th className="py-2 pr-3">Тариф</th>
                        <th className="py-2 pr-3">Сумма</th>
                        <th className="py-2 pr-3">Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {user.recentPayments.map((p) => (
                        <tr
                          key={p.id}
                          className="border-b border-border last:border-0"
                        >
                          <td className="py-2 pr-3 text-muted">
                            {formatDateTime(p.succeededAt ?? p.createdAt)}
                          </td>
                          <td className="py-2 pr-3 text-foreground">
                            {PLAN_LABEL[p.plan] ?? p.plan}
                          </td>
                          <td className="py-2 pr-3 tabular-nums text-foreground">
                            {p.amountRub.toLocaleString("ru-RU")} ₽
                          </td>
                          <td className="py-2 pr-3">
                            <PaymentStatus status={p.status} />
                            {p.failureReason && (
                              <p className="mt-1 text-xs text-danger">
                                {p.failureReason}
                              </p>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                </section>
              )}
            </div>
          )}
        </div>
      </AppShell>
  );
}

function UsageStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-surface/50 p-3">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold text-foreground tabular-nums">
        {value.toLocaleString("ru-RU")}
      </p>
    </div>
  );
}

interface WorkspaceCardProps {
  membership: MembershipInfo;
  isOwner: boolean;
  acting: string | null;
  onExtendTrial: (days: number) => void;
  onChangePlan: (plan: AdminPlanCode) => void;
}

function WorkspaceCard({
  membership,
  isOwner,
  acting,
  onExtendTrial,
  onChangePlan,
}: WorkspaceCardProps) {
  const { org, role } = membership;
  const planChip =
    org.plan === "BUSINESS"
      ? "bg-warning-light text-warning"
      : org.plan === "PRO_SOLO" ||
          org.plan === "PRO_TEAM" ||
          org.plan === "PRO"
        ? "bg-primary-light text-primary-dark"
        : "bg-surface text-muted";
  const PlanIcon =
    org.plan === "FREE" ? Zap : Crown;
  // Date.now() in render trips react-hooks/purity, but for an admin-only
  // "trial still active?" badge the re-render instability is benign — the
  // value only flips at the exact expiry instant.
  // eslint-disable-next-line react-hooks/purity
  const trialActive = !!org.trialEndsAt && new Date(org.trialEndsAt).getTime() > Date.now();

  return (
    <div className="rounded-xl border border-border bg-surface/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="font-semibold text-foreground">{org.name}</p>
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${planChip}`}
            >
              <PlanIcon className="h-3 w-3" />
              {PLAN_LABEL[org.plan] ?? org.plan}
            </span>
            <span className="rounded-md bg-surface px-2 py-0.5 text-xs font-semibold text-muted">
              {role}
            </span>
            {trialActive && (
              <span className="inline-flex items-center gap-1 rounded-md bg-warning-light px-2 py-0.5 text-xs font-semibold text-warning">
                <Sparkles className="h-3 w-3" />
                Триал до {formatDate(org.trialEndsAt!)}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted">
            {org.memberCount} участник
            {org.memberCount === 1 ? "" : org.memberCount < 5 ? "а" : "ов"} ·
            создан {formatDate(org.createdAt)}
          </p>
          {org.subscription && (
            <p className="mt-1 text-xs text-muted">
              Подписка: {org.subscription.status} до{" "}
              {formatDate(org.subscription.currentPeriodEnd)}
            </p>
          )}
        </div>
        {isOwner && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onExtendTrial(7)}
              disabled={acting === `trial-${org.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-warning/40 bg-warning-light px-3 py-1.5 text-xs font-semibold text-warning transition-colors hover:bg-warning-light disabled:opacity-50"
            >
              <Calendar className="h-3.5 w-3.5" />+7 дней триала
            </button>
            <select
              defaultValue={org.plan}
              onChange={(e) => {
                const v = e.target.value as AdminPlanCode;
                if (v !== org.plan) onChangePlan(v);
              }}
              disabled={acting === `plan-${org.id}`}
              className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
              title="Сменить тариф вручную (без оплаты)"
            >
              <option value="FREE">→ Старт</option>
              <option value="PRO_SOLO">→ Pro Solo</option>
              <option value="PRO_TEAM">→ Pro Team</option>
              <option value="BUSINESS">→ Бизнес</option>
            </select>
          </div>
        )}
        {!isOwner && (
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <ShieldCheck className="h-3.5 w-3.5" />
            Не владелец — действия недоступны
          </span>
        )}
      </div>
    </div>
  );
}
