"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  Loader2,
  AlertCircle,
  Filter,
} from "lucide-react";

interface AuditEvent {
  id: string;
  action: string;
  target: string | null;
  targetType: string | null;
  payload: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  actor: {
    id: string;
    email: string;
    name: string | null;
  };
}

interface AuditResponse {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  events: AuditEvent[];
}

// Russian labels for the controlled-vocab actions. Anything missing
// falls through to the raw key — better to surface unknown actions
// verbatim than hide them from an admin trying to debug.
const ACTION_LABELS: Record<string, string> = {
  "workspace.created": "Создан workspace",
  "workspace.deleted": "Удалён workspace",
  "workspace.renamed": "Переименован workspace",
  "member.invited": "Приглашён участник",
  "member.invite_revoked": "Отозвано приглашение",
  "member.invite_accepted": "Принято приглашение",
  "member.removed": "Удалён участник",
  "member.left": "Вышел из workspace",
  "member.role_changed": "Изменена роль",
  "billing.checkout_started": "Начата оплата",
  "billing.payment_succeeded": "Платёж получен",
  "billing.payment_failed": "Платёж не прошёл",
  "billing.subscription_canceled": "Отменена подписка",
  "billing.plan_changed_manually": "Тариф изменён вручную (admin)",
  "trial.activated": "Активирован пробный период",
  "trial.extended": "Продлён пробный период (admin)",
  "document.deleted": "Удалён документ",
  "document.refined_ai": "AI-доработка документа",
  "auth.password_reset": "Сброшен пароль",
  "auth.2fa_enabled": "Включена 2FA",
  "auth.2fa_disabled": "Отключена 2FA",
  "account.signup_consent_granted": "Принято согласие на обработку ПДн",
  "email.trial_expiring_sent": "Письмо об окончании триала",
  "email.trial_expired_sent": "Письмо о завершении триала",
  "email.inactive_reengagement_sent": "Реактивационное письмо",
  "email.checkout_abandoned_sent": "Письмо о недозавершённом платеже",
};

const ACTION_GROUPS: Array<{ label: string; values: string[] }> = [
  {
    label: "Все",
    values: [],
  },
  {
    label: "Участники",
    values: [
      "member.invited",
      "member.invite_revoked",
      "member.invite_accepted",
      "member.removed",
      "member.left",
      "member.role_changed",
    ],
  },
  {
    label: "Биллинг",
    values: [
      "billing.checkout_started",
      "billing.payment_succeeded",
      "billing.payment_failed",
      "billing.subscription_canceled",
      "billing.plan_changed_manually",
      "trial.activated",
      "trial.extended",
    ],
  },
  {
    label: "Документы",
    values: ["document.deleted", "document.refined_ai"],
  },
  {
    label: "Безопасность",
    values: ["auth.password_reset", "auth.2fa_enabled", "auth.2fa_disabled"],
  },
];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AuditLogPage() {
  const { data: session } = useSession();
  const orgId = session?.user?.activeOrgId;

  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const u = new URLSearchParams();
    if (actionFilter.length > 0) u.set("action", actionFilter.join(","));
    if (page > 1) u.set("page", String(page));
    fetch(`/api/organizations/${orgId}/audit?${u.toString()}`)
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 403) {
          setError(
            "Журнал доступен только администраторам и владельцам workspace."
          );
          return;
        }
        if (!r.ok) {
          setError(`Ошибка ${r.status}`);
          return;
        }
        setData((await r.json()) as AuditResponse);
      })
      .catch(() => !cancelled && setError("Сеть недоступна."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [orgId, actionFilter, page]);

  return (
    <AppShell>
      <PageHeader
        title="Журнал событий"
        description="Все значимые действия в этом workspace — кто, когда, что изменил."
      />
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">

          {/* Filter chips */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted" />
            {ACTION_GROUPS.map((g) => {
              const active =
                g.values.length === 0
                  ? actionFilter.length === 0
                  : g.values.every((v) => actionFilter.includes(v)) &&
                    actionFilter.length === g.values.length;
              return (
                <button
                  key={g.label}
                  type="button"
                  onClick={() => {
                    setActionFilter(g.values);
                    setPage(1);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "bg-primary text-white"
                      : "border border-border bg-card text-foreground hover:bg-surface"
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
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
              <p className="mb-3 text-sm text-muted">
                {data.total.toLocaleString("ru-RU")} событий
              </p>
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="overflow-x-auto -mx-4 sm:mx-0"><table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface/50 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                      <th className="px-4 py-3">Время</th>
                      <th className="px-4 py-3">Кто</th>
                      <th className="px-4 py-3">Действие</th>
                      <th className="px-4 py-3">Цель</th>
                      <th className="px-4 py-3">Контекст</th>
                      <th className="px-4 py-3">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-12 text-center text-muted"
                        >
                          {actionFilter.length > 0
                            ? "Нет событий по этому фильтру."
                            : "Журнал пуст. События появятся когда кто-то выполнит значимое действие в workspace."}
                        </td>
                      </tr>
                    )}
                    {data.events.map((e) => {
                      const label = ACTION_LABELS[e.action] ?? e.action;
                      const payload = e.payload as
                        | Record<string, unknown>
                        | null;
                      return (
                        <tr
                          key={e.id}
                          className="border-b border-border last:border-0 align-top hover:bg-surface/40"
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-muted">
                            {formatDateTime(e.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">
                              {e.actor.email}
                            </div>
                            {e.actor.name && (
                              <div className="text-xs text-muted">
                                {e.actor.name}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">
                              {label}
                            </div>
                            {label !== e.action && (
                              <div className="text-xs text-muted">
                                <code className="text-[10px]">{e.action}</code>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-muted">
                            {e.targetType && (
                              <div>
                                {e.targetType}: {e.target ?? "—"}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted">
                            {payload && Object.keys(payload).length > 0 ? (
                              <pre className="max-w-xs overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px]">
                                {JSON.stringify(payload, null, 2)}
                              </pre>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-muted">
                            {e.ip ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
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
