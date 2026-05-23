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

// formatResetDate + ProgressBar were used by the old card layout. The
// compact strip relies on inline "N / M" counts instead — reset date
// and progress visualisation were the dominant noise on BUSINESS-tier
// dashboards. Reset date is still shown on /billing.

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
  const isFree = data.plan === "FREE";
  const isTrial = !!data.isTrial;
  const daysLeft = data.trialDaysLeft ?? null;

  // Decide whether to show the per-feature usage at all. For tiers where
  // every shown feature is unlimited (BUSINESS in practice), the bars
  // collapse to a row of three "Безлимит" labels — pure visual noise.
  // The plan label already lives in AccountMenu's chip; this widget
  // only earns space when it carries quota info the user can act on.
  const shownFeatures = (["analyze", "generate", "ocr"] as const).filter((key) => {
    const u = data.features[key];
    if (!u) return false;
    if (key === "ocr" && !u.unlimited && u.limit === 0) return false;
    return true;
  });
  const allUnlimited = shownFeatures.every((key) => data.features[key]?.unlimited);

  // Nothing actionable to show — and not a trial. Hide entirely.
  if (allUnlimited && !isTrial) {
    return null;
  }

  // Quota present: render a single-row strip rather than the old
  // 9-line card. Inline counts, no big chip/icon, no separate reset
  // line — reset date is in /billing for those who care.
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className={`font-semibold ${planMeta.chipText}`}>
          {planMeta.label}
        </span>
        {isTrial && typeof daysLeft === "number" && (
          <span className="rounded-md bg-warning-light px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning">
            Триал · {daysLeft} {pluralizeDays(daysLeft)}
          </span>
        )}
        {shownFeatures.map((key) => {
          const usage = data.features[key];
          if (!usage) return null;
          const meta = FEATURE_META[key];
          const Icon = meta.icon;
          return (
            <span key={key} className="flex items-center gap-1.5 text-muted">
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{meta.label}</span>
              <span className={usage.unlimited ? "text-success font-medium" : "text-foreground font-medium"}>
                {usage.unlimited ? "∞" : `${usage.used} / ${usage.limit}`}
              </span>
            </span>
          );
        })}
        {(isFree || (isTrial && typeof daysLeft === "number")) && (
          <Link
            href="/billing"
            className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            {isTrial ? "Оформить подписку" : "Перейти на Pro"}
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}
