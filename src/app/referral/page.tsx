"use client";

// Referral programme — the user's invite link, bonus balance and stats.

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  Gift,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Users,
  Sparkles,
} from "lucide-react";

interface ReferralData {
  code: string;
  url: string;
  bonusAnalyses: number;
  bonusPerReferral: number;
  referredCount: number;
  activatedCount: number;
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">
        {value}
      </p>
    </div>
  );
}

export default function ReferralPage() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/referral")
      .then(async (r) => {
        if (!r.ok) {
          setError("Не удалось загрузить реферальные данные");
          return;
        }
        setData((await r.json()) as ReferralData);
      })
      .catch(() => setError("Сеть недоступна"));
  }, []);

  async function copy() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the field is selectable as a fallback */
    }
  }

  return (
    <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light">
              <Gift className="h-5 w-5 text-primary-dark" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Пригласите коллег
              </h1>
              <p className="text-sm text-muted">
                За каждого, кто зарегистрируется по вашей ссылке и
                активирует пробный период, вы оба получаете бонусные
                анализы договоров.
              </p>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-light px-4 py-3 text-sm text-danger"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {data === null && !error && (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted" />
            </div>
          )}

          {data && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="mb-1 text-sm font-semibold text-foreground">
                  Ваша реферальная ссылка
                </p>
                <p className="mb-3 text-xs text-muted">
                  +{data.bonusPerReferral} анализа вам и +
                  {data.bonusPerReferral} приглашённому после активации.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    readOnly
                    value={data.url}
                    onFocus={(e) => e.currentTarget.select()}
                    className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
                  />
                  <button
                    type="button"
                    onClick={copy}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-dark"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copied ? "Скопировано" : "Копировать"}
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted">
                  Код приглашения:{" "}
                  <span className="font-mono font-semibold text-foreground">
                    {data.code}
                  </span>
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Stat
                  label="Приглашено"
                  value={data.referredCount}
                  icon={Users}
                />
                <Stat
                  label="Активировали"
                  value={data.activatedCount}
                  icon={Check}
                />
                <Stat
                  label="Бонусных анализов"
                  value={data.bonusAnalyses}
                  icon={Sparkles}
                />
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted">
                <p className="mb-2 font-semibold text-foreground">
                  Как это работает
                </p>
                <ol className="list-decimal space-y-1 pl-5">
                  <li>Отправьте ссылку коллеге или партнёру.</li>
                  <li>Он регистрируется и активирует пробный период.</li>
                  <li>
                    Вам обоим начисляется по {data.bonusPerReferral} бонусных
                    анализа — они суммируются с бесплатным месячным лимитом.
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </AppShell>
  );
}
