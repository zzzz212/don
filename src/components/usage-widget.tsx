"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Crown,
  Zap,
  FileSearch,
  FileText,
  Sparkles,
  Loader2,
  ArrowRight,
} from "lucide-react";

interface FeatureUsage {
  used: number;
  limit: number | null;
  unlimited: boolean;
  remaining: number | null;
}

interface UsageData {
  // Raw plan code from /api/usage — FREE / PRO / PRO_SOLO / PRO_TEAM /
  // BUSINESS. Typed as string deliberately: a new tier must never crash
  // the widget just because it isn't in PLAN_META yet.
  plan: string;
  isTrial?: boolean;
  trialDaysLeft?: number | null;
  resetsAt: string;
  features: {
    analyze?: FeatureUsage;
    generate?: FeatureUsage;
    ocr?: FeatureUsage;
    chat?: FeatureUsage;
  };
}

function pluralizeDays(n: number): string {
  if (n === 1) return "день";
  if (n >= 2 && n <= 4) return "дня";
  return "дней";
}

const FEATURE_META: Record<
  "analyze" | "generate" | "ocr",
  { label: string; icon: typeof FileSearch }
> = {
  analyze: { label: "Анализы", icon: FileSearch },
  generate: { label: "Документы", icon: FileText },
  ocr: { label: "Распознавание сканов", icon: Sparkles },
};

// Keyed by every plan code /api/usage can return. The 5-tier pricing
// rollout added PRO_SOLO / PRO_TEAM and a legacy "PRO" still exists in
// the DB. A missing key here used to crash the whole dashboard
// (PLAN_META[plan].icon read on undefined) — the lookup below also
// falls back, so an unknown future tier degrades instead of crashing.
const PLAN_META: Record<
  string,
  { label: string; chipBg: string; chipText: string; icon: typeof Crown }
> = {
  FREE: {
    label: "Старт",
    chipBg: "bg-surface",
    chipText: "text-muted",
    icon: Zap,
  },
  PRO: {
    label: "Про",
    chipBg: "bg-primary-light",
    chipText: "text-primary-dark",
    icon: Crown,
  },
  PRO_SOLO: {
    label: "Pro Solo",
    chipBg: "bg-primary-light",
    chipText: "text-primary-dark",
    icon: Crown,
  },
  PRO_TEAM: {
    label: "Pro Team",
    chipBg: "bg-primary-light",
    chipText: "text-primary-dark",
    icon: Crown,
  },
  BUSINESS: {
    label: "Бизнес",
    chipBg: "bg-warning-light",
    chipText: "text-warning",
    icon: Crown,
  },
};

function formatResetDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
    });
  } catch {
    return "—";
  }
}

function ProgressBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const color =
    pct >= 100
      ? "bg-danger"
      : pct >= 80
        ? "bg-warning"
        : "bg-primary";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
      <div
        className={`h-full ${color} transition-all`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function UsageWidget() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/usage")
      .then((r) => {
        if (r.status === 401) return null;
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((json) => {
        if (cancelled) return;
        if (json) setData(json as UsageData);
        else setError(true);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-card p-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted" />
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  // Fall back to FREE styling for any plan code missing from the table —
  // the dashboard must degrade gracefully, never crash, on a new tier.
  const planMeta = PLAN_META[data.plan] ?? PLAN_META.FREE;
  const PlanIcon = planMeta.icon;
  const isFree = data.plan === "FREE";
  const isTrial = !!data.isTrial;
  const daysLeft = data.trialDaysLeft ?? null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${planMeta.chipBg}`}
          >
            <PlanIcon className={`h-5 w-5 ${planMeta.chipText}`} />
          </div>
          <div>
            <p className="text-xs text-muted">Тариф</p>
            <div className="flex items-center gap-2">
              <p className={`font-semibold ${planMeta.chipText}`}>
                {planMeta.label}
              </p>
              {isTrial && typeof daysLeft === "number" && (
                <span className="rounded-md bg-warning-light px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning">
                  Триал · {daysLeft} {pluralizeDays(daysLeft)}
                </span>
              )}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted">
          Сброс {formatResetDate(data.resetsAt)}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(["analyze", "generate", "ocr"] as const).map((key) => {
          const usage = data.features[key];
          if (!usage) return null;
          // OCR is gated to PRO/BUSINESS — on FREE plans the limit is 0
          // and showing it as a usage row just confuses users ("why is
          // there a 0/0 here?"). Suppress; the upgrade banner below
          // still mentions OCR as a perk of upgrading.
          if (key === "ocr" && !usage.unlimited && usage.limit === 0) {
            return null;
          }
          const meta = FEATURE_META[key];
          const Icon = meta.icon;

          return (
            <div key={key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <Icon className="h-3.5 w-3.5" />
                  {meta.label}
                </span>
                {usage.unlimited ? (
                  <span className="text-xs font-semibold text-success">
                    Безлимит
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-foreground">
                    {usage.used} / {usage.limit}
                  </span>
                )}
              </div>
              {!usage.unlimited && usage.limit !== null && usage.limit > 0 && (
                <ProgressBar used={usage.used} limit={usage.limit} />
              )}
            </div>
          );
        })}
      </div>

      {isTrial && typeof daysLeft === "number" ? (
        <Link
          href="/billing"
          className="mt-4 flex items-center justify-between rounded-lg border border-warning/40 bg-warning-light px-4 py-2.5 text-sm font-semibold text-warning transition-colors hover:bg-warning-light"
        >
          <span>
            Пробный «Про» — осталось {daysLeft} {pluralizeDays(daysLeft)}. Оформите подписку, чтобы не потерять доступ.
          </span>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Link>
      ) : isFree ? (
        <Link
          href="/billing"
          className="mt-4 flex items-center justify-between rounded-lg border border-primary/30 bg-primary-light/30 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary-light/50"
        >
          <span>Перейти на «Про» — безлимитный анализ + распознавание сканов</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}
