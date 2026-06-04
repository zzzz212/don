"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Crown,
  Zap,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { BillingCardSkeleton } from "@/components/skeleton";
import { TRIAL_DAYS, CONTACTS } from "@/lib/legal-info";

// Russian plural for "день" depending on count — 1 день / 2-4 дня / 5+ дней.
// The trial UI only needs the singular ("1 день"), few ("2-4 дня") and many
// ("5+ дней") forms; mirrors the same helper /billing already uses for
// "trial X days left" rendering.
function dayWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дня";
  return "дней";
}

interface SubscriptionInfo {
  plan: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  hasSavedPaymentMethod: boolean;
}

interface PaymentRow {
  id: string;
  plan: string;
  amountRub: number;
  currency: string;
  status: string;
  createdAt: string;
  succeededAt: string | null;
  failureReason: string | null;
}

// Effective plan strings that quota / tier-policy ever resolves to.
// Legacy "PRO" is still tolerated on the wire (PaidPlan type widens to
// include it) but the API normalises it to PRO_SOLO before rendering,
// so the union here stays narrow.
type EffectivePlanCode = "FREE" | "PRO_SOLO" | "PRO_TEAM" | "BUSINESS";
type CheckoutPlanCode = "PRO_SOLO" | "PRO_TEAM" | "BUSINESS";

interface BillingStatus {
  orgId: string;
  orgName: string;
  effectivePlan: EffectivePlanCode;
  baselinePlan: EffectivePlanCode;
  isTrial: boolean;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  canActivateTrial: boolean;
  subscription: SubscriptionInfo | null;
  payments: PaymentRow[];
}

const PLAN_LABEL: Record<string, string> = {
  FREE: "Старт",
  PRO_SOLO: "Pro Solo",
  PRO_TEAM: "Pro Team",
  BUSINESS: "Бизнес",
  // Legacy: status API may still surface old "PRO" rows.
  PRO: "Pro Solo",
};

const PLAN_PRICE_RUB: Record<CheckoutPlanCode, number> = {
  PRO_SOLO: 1990,
  PRO_TEAM: 4990,
  BUSINESS: 14990,
};

const PLAN_DESCRIPTION: Record<CheckoutPlanCode, string> = {
  PRO_SOLO: "Для ИП и фрилансеров",
  PRO_TEAM: "Для команд до 5 человек",
  BUSINESS: "Для компаний и юр.отделов",
};

const PLAN_FEATURES: Record<CheckoutPlanCode, string[]> = {
  PRO_SOLO: [
    "До 100 анализов договоров в месяц",
    "Безлимитная генерация документов",
    "OCR для скан-PDF",
    "Векторный поиск по договорам",
    "Приоритетная поддержка",
  ],
  PRO_TEAM: [
    "Всё из Pro Solo",
    "До 5 участников рабочего пространства",
    "500 анализов в месяц на команду",
    "Совместная история анализов",
  ],
  BUSINESS: [
    "Всё из Pro Team",
    "Безлимитные анализы",
    "Анализ на модели Opus (точнее, дороже)",
    "Расширенная история (без ограничения)",
    "Персональный менеджер",
  ],
};

const CHECKOUT_PLANS: readonly CheckoutPlanCode[] = [
  "PRO_SOLO",
  "PRO_TEAM",
  "BUSINESS",
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    SUCCEEDED: { label: "Оплачено", cls: "bg-success/10 text-success" },
    PENDING: { label: "Ожидает оплаты", cls: "bg-warning-light text-warning" },
    WAITING_FOR_CAPTURE: {
      label: "Ожидает подтверждения",
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

export default function BillingPage() {
  const [data, setData] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<
    CheckoutPlanCode | null
  >(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [trialActivating, setTrialActivating] = useState(false);
  const [trialError, setTrialError] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    fetch("/api/billing/status")
      .then(async (r) => {
        if (r.status === 401) {
          window.location.href = "/login";
          return null;
        }
        if (r.status === 403) {
          setError("Только владелец workspace может управлять биллингом.");
          return null;
        }
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          setError(j.error ?? "Не удалось загрузить состояние биллинга.");
          return null;
        }
        return (await r.json()) as BillingStatus;
      })
      .then((json) => setData(json))
      .catch(() => setError("Сеть недоступна."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, []);

  const handleActivateTrial = async () => {
    setTrialActivating(true);
    setTrialError(null);
    try {
      const r = await fetch("/api/billing/activate-trial", {
        method: "POST",
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        setTrialError(json.error ?? "Не удалось активировать пробный период.");
        return;
      }
      // Reload billing status so the trial banner / chip / quota all
      // re-render with the new state.
      reload();
    } catch {
      setTrialError("Сеть недоступна.");
    } finally {
      setTrialActivating(false);
    }
  };

  const handleCancelToggle = async (resume: boolean) => {
    setCancelLoading(true);
    setCancelError(null);
    try {
      const r = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        setCancelError(json.error ?? "Не удалось изменить подписку.");
        return;
      }
      // Re-read so the badge / "действует до" / toggle reflect the new
      // cancelAtPeriodEnd state.
      reload();
    } catch {
      setCancelError("Сеть недоступна.");
    } finally {
      setCancelLoading(false);
    }
  };

  const handleCheckout = async (plan: CheckoutPlanCode) => {
    setCheckoutLoading(plan);
    setCheckoutError(null);
    try {
      const r = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        setCheckoutError(json.error ?? "Не удалось начать оплату.");
        return;
      }
      if (json.confirmationUrl) {
        window.location.href = json.confirmationUrl;
      } else {
        setCheckoutError("ЮKassa не вернула URL. Свяжитесь с поддержкой.");
      }
    } catch {
      setCheckoutError("Сеть недоступна.");
    } finally {
      setCheckoutLoading(null);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Биллинг и тарифы"
        description="Тариф привязан к вашему аккаунту — одна подписка действует во всех ваших workspace. Ниже история платежей и смена тарифа."
      />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">

          {loading && (
            <div className="space-y-6">
              <BillingCardSkeleton />
              <div className="grid gap-6 md:grid-cols-2">
                <BillingCardSkeleton />
                <BillingCardSkeleton />
              </div>
            </div>
          )}

          {!loading && error && (
            <div role="alert" className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-light px-4 py-3 text-sm text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {!loading && data && (
            <>
              {/* Current plan card */}
              <section className="mb-10 rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Ваш аккаунт
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-foreground">
                      Тариф «{PLAN_LABEL[data.effectivePlan] ?? data.effectivePlan}»
                    </h2>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-semibold ${data.effectivePlan === "FREE" ? "bg-surface text-muted" : "bg-primary-light text-primary-dark"}`}
                      >
                        {data.effectivePlan === "FREE" ? (
                          <Zap className="h-3.5 w-3.5" />
                        ) : (
                          <Crown className="h-3.5 w-3.5" />
                        )}
                        {PLAN_LABEL[data.effectivePlan] ?? data.effectivePlan}
                      </span>
                      {data.isTrial && data.trialDaysLeft !== null && (
                        <span className="rounded-lg bg-warning-light px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-warning">
                          Триал · {data.trialDaysLeft}{" "}
                          {data.trialDaysLeft === 1
                            ? "день"
                            : data.trialDaysLeft >= 2 && data.trialDaysLeft <= 4
                              ? "дня"
                              : "дней"}{" "}
                          осталось
                        </span>
                      )}
                    </div>
                  </div>

                  {data.subscription && data.subscription.status === "ACTIVE" && (
                    <div className="text-right">
                      <p className="text-xs text-muted">Действует до</p>
                      <p className="mt-1 text-base font-semibold text-foreground">
                        {formatDate(data.subscription.currentPeriodEnd)}
                      </p>
                    </div>
                  )}
                </div>

                {data.isTrial && (
                  <div className="mt-5 rounded-xl border border-warning/30 bg-warning-light px-4 py-3 text-sm text-warning">
                    Пробный период тарифа «Про» закончится{" "}
                    <strong>{formatDate(data.trialEndsAt)}</strong>. Оформите
                    подписку до этой даты, чтобы избежать перехода на ограниченный
                    тариф «Старт».
                  </div>
                )}

                {data.subscription && data.subscription.status === "CANCELED" && (
                  <div className="mt-5 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground">
                    Подписка отменена{" "}
                    {formatDate(data.subscription.canceledAt)}. Доступ к функциям
                    тарифа сохраняется до{" "}
                    <strong>{formatDate(data.subscription.currentPeriodEnd)}</strong>.
                  </div>
                )}

                {data.subscription && data.subscription.status === "ACTIVE" && (
                  <div className="mt-5 border-t border-border pt-5">
                    {cancelError && (
                      <p className="mb-3 flex items-center gap-1.5 text-sm text-danger">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {cancelError}
                      </p>
                    )}
                    {data.subscription.cancelAtPeriodEnd ? (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-muted">
                          Подписка будет отменена{" "}
                          <strong className="text-foreground">
                            {formatDate(data.subscription.currentPeriodEnd)}
                          </strong>
                          . До этой даты доступ сохраняется.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleCancelToggle(true)}
                          disabled={cancelLoading}
                          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
                        >
                          {cancelLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Сохраняем...
                            </>
                          ) : (
                            "Возобновить подписку"
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-muted">
                          Вы можете отключить продление в любой момент — доступ
                          сохранится до конца оплаченного периода.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleCancelToggle(false)}
                          disabled={cancelLoading}
                          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface disabled:opacity-50"
                        >
                          {cancelLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Отменяем...
                            </>
                          ) : (
                            "Отменить подписку"
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {data.canActivateTrial && (
                  <div className="mt-5 rounded-xl border border-primary/30 bg-primary-light/30 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">
                          Активируйте бесплатный пробный период «Про»
                        </p>
                        <p className="mt-1 text-sm text-muted">
                          {TRIAL_DAYS} {dayWord(TRIAL_DAYS)} безлимитного анализа
                          договоров, генерации документов и OCR. Без привязки
                          карты и автосписаний. Доступно один раз для каждого
                          аккаунта.
                        </p>
                        {trialError && (
                          <p className="mt-2 flex items-center gap-1.5 text-sm text-danger">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {trialError}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={handleActivateTrial}
                          disabled={trialActivating}
                          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
                        >
                          {trialActivating ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Активируем...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              Активировать на {TRIAL_DAYS} {dayWord(TRIAL_DAYS)}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Plans grid */}
              {checkoutError && (
                <div role="alert" className="mb-6 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-light px-4 py-3 text-sm text-danger">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {checkoutError}
                </div>
              )}

              <section className="mb-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {CHECKOUT_PLANS.map((plan) => {
                  // Subscription.plan may still be the legacy "PRO" string
                  // for grandfathered customers — treat it as PRO_SOLO so
                  // the "current tariff" highlight is correct.
                  const subPlan = data.subscription?.plan ?? null;
                  const normalisedSubPlan =
                    subPlan === "PRO" ? "PRO_SOLO" : subPlan;
                  const isCurrent =
                    normalisedSubPlan === plan &&
                    data.subscription?.status === "ACTIVE" &&
                    new Date(data.subscription.currentPeriodEnd).getTime() >
                      Date.now();
                  // PRO_SOLO is the popularly marketed tier — most signups
                  // start here. Pro Team gets ringed too, secondary, when
                  // we have the team-pricing story.
                  const popular = plan === "PRO_SOLO";
                  return (
                    <div
                      key={plan}
                      className={`relative rounded-2xl border bg-card p-6 ${popular ? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary" : "border-border"}`}
                    >
                      {popular && (
                        <div className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-fg">
                          Рекомендуем
                        </div>
                      )}
                      <h3 className="font-serif text-lg font-semibold text-foreground">
                        {PLAN_LABEL[plan]}
                      </h3>
                      <p className="mt-1 text-sm text-muted">
                        {PLAN_DESCRIPTION[plan]}
                      </p>
                      <div className="mt-4 flex items-baseline gap-1">
                        <span className="font-serif text-3xl font-semibold text-foreground">
                          {new Intl.NumberFormat("ru-RU").format(
                            PLAN_PRICE_RUB[plan]
                          )}{" "}
                          ₽
                        </span>
                        <span className="text-sm text-muted"> / мес</span>
                      </div>
                      <ul className="mt-5 space-y-2">
                        {PLAN_FEATURES[plan].map((f) => (
                          <li
                            key={f}
                            className="flex items-start gap-2 text-sm text-foreground"
                          >
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => handleCheckout(plan)}
                        disabled={
                          checkoutLoading !== null || isCurrent
                        }
                        className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors disabled:opacity-50 ${popular ? "bg-primary text-white hover:bg-primary-dark" : "border border-border bg-card text-foreground hover:bg-surface"}`}
                      >
                        {checkoutLoading === plan ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Открываем оплату...
                          </>
                        ) : isCurrent ? (
                          "Текущий тариф"
                        ) : (
                          <>
                            Перейти на «{PLAN_LABEL[plan]}»
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </section>

              {/* Enterprise is intentionally not a checkout target — the
                  sales conversation happens by email (SLA, on-prem,
                  custom data residency are case-by-case). Keeps the
                  pricing page honest about what you can self-serve. */}
              <section className="mb-10 rounded-2xl border border-border bg-surface/30 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      Enterprise
                    </h3>
                    <p className="mt-1 text-sm text-muted">
                      SLA 99.9%, on-premise / частное облако, индивидуальные
                      условия по данным, отдельный контракт. От 20 рабочих
                      мест.
                    </p>
                  </div>
                  <a
                    href={`mailto:${CONTACTS.support}?subject=Enterprise%20%E2%80%94%20%D0%97%D0%B0%D0%BF%D1%80%D0%BE%D1%81%20%D1%83%D1%81%D0%BB%D0%BE%D0%B2%D0%B8%D0%B9`}
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
                  >
                    Связаться <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </section>

              {/* Payment history */}
              <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-lg font-bold text-foreground">
                  История платежей
                </h2>
                {data.payments.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">
                    Здесь появятся ваши платежи после первой оплаты.
                  </p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted">
                          <th className="py-2 pr-4">Дата</th>
                          <th className="py-2 pr-4">Тариф</th>
                          <th className="py-2 pr-4">Сумма</th>
                          <th className="py-2 pr-4">Статус</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.payments.map((p) => (
                          <tr
                            key={p.id}
                            className="border-b border-border last:border-0"
                          >
                            <td className="py-3 pr-4 text-muted">
                              {formatDateTime(p.succeededAt ?? p.createdAt)}
                            </td>
                            <td className="py-3 pr-4 font-medium text-foreground">
                              {PLAN_LABEL[p.plan] ?? p.plan}
                            </td>
                            <td className="py-3 pr-4 tabular-nums text-foreground">
                              {new Intl.NumberFormat("ru-RU").format(p.amountRub)}{" "}
                              ₽
                            </td>
                            <td className="py-3 pr-4">
                              <PaymentStatusBadge status={p.status} />
                              {p.failureReason && (
                                <p className="mt-1 text-xs text-danger">
                                  {p.failureReason}
                                </p>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <p className="mt-6 text-center text-xs text-muted">
                Оплачивая подписку, вы принимаете{" "}
                <Link href="/offer" className="underline hover:text-foreground">
                  Публичную оферту
                </Link>
                .
              </p>
            </>
          )}
        </div>
      </AppShell>
  );
}
