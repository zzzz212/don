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
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";

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

interface BillingStatus {
  orgId: string;
  orgName: string;
  effectivePlan: "FREE" | "PRO" | "BUSINESS";
  baselinePlan: "FREE" | "PRO" | "BUSINESS";
  isTrial: boolean;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  canActivateTrial: boolean;
  subscription: SubscriptionInfo | null;
  payments: PaymentRow[];
}

const PLAN_LABEL: Record<string, string> = {
  FREE: "Старт",
  PRO: "Про",
  BUSINESS: "Бизнес",
};

const PLAN_PRICE_RUB: Record<"PRO" | "BUSINESS", number> = {
  PRO: 3990,
  BUSINESS: 14990,
};

const PLAN_FEATURES: Record<"PRO" | "BUSINESS", string[]> = {
  PRO: [
    "Безлимитный анализ договоров",
    "Безлимитная генерация документов",
    "OCR для скан-PDF",
    "Векторный поиск по договорам",
    "Приоритетная поддержка",
  ],
  BUSINESS: [
    "Всё из тарифа «Про»",
    "До 10 участников рабочего пространства",
    "Совместная история анализов",
    "API-доступ (после релиза)",
    "Персональный менеджер",
  ],
};

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
    PENDING: { label: "Ожидает оплаты", cls: "bg-amber-100 text-amber-800" },
    WAITING_FOR_CAPTURE: {
      label: "Ожидает подтверждения",
      cls: "bg-amber-100 text-amber-800",
    },
    CANCELED: { label: "Отменён", cls: "bg-surface text-muted" },
    FAILED: { label: "Ошибка", cls: "bg-red-100 text-red-700" },
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
    "PRO" | "BUSINESS" | null
  >(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [trialActivating, setTrialActivating] = useState(false);
  const [trialError, setTrialError] = useState<string | null>(null);

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

  const handleCheckout = async (plan: "PRO" | "BUSINESS") => {
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
    <div className="flex min-h-full flex-col bg-white">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              Биллинг и тарифы
            </h1>
            <p className="mt-2 text-base text-muted">
              Текущая подписка, история платежей и переход на платный тариф.
            </p>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted" />
            </div>
          )}

          {!loading && error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
                      Workspace
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-foreground">
                      {data.orgName}
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
                        <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-700">
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
                  <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
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
                          7 дней безлимитного анализа договоров, генерации
                          документов и OCR. Без привязки карты и
                          автосписаний. Доступно один раз для каждого
                          аккаунта.
                        </p>
                        {trialError && (
                          <p className="mt-2 flex items-center gap-1.5 text-sm text-red-700">
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
                              Активировать на 7 дней
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
                <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {checkoutError}
                </div>
              )}

              <section className="mb-10 grid gap-6 md:grid-cols-2">
                {(["PRO", "BUSINESS"] as const).map((plan) => {
                  const isCurrent =
                    data.subscription?.plan === plan &&
                    data.subscription?.status === "ACTIVE" &&
                    new Date(data.subscription.currentPeriodEnd).getTime() >
                      Date.now();
                  const popular = plan === "PRO";
                  return (
                    <div
                      key={plan}
                      className={`relative rounded-2xl border bg-card p-6 ${popular ? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary" : "border-border"}`}
                    >
                      {popular && (
                        <div className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                          Популярный
                        </div>
                      )}
                      <h3 className="text-lg font-bold text-foreground">
                        {PLAN_LABEL[plan]}
                      </h3>
                      <p className="mt-1 text-sm text-muted">
                        {plan === "PRO"
                          ? "Для ИП и фрилансеров"
                          : "Для компаний до 10 человек"}
                      </p>
                      <div className="mt-4">
                        <span className="text-3xl font-extrabold text-foreground">
                          {new Intl.NumberFormat("ru-RU").format(
                            PLAN_PRICE_RUB[plan]
                          )}{" "}
                          ₽
                        </span>
                        <span className="text-muted"> / мес</span>
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
                        className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors disabled:opacity-50 ${popular ? "bg-primary text-white hover:bg-primary-dark" : "border border-border bg-white text-foreground hover:bg-surface"}`}
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
                                <p className="mt-1 text-xs text-red-600">
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
      </main>
      <Disclaimer />
    </div>
  );
}
