// Public, read-only view of a contract analysis. Reachable by anyone
// holding the link — no login. Shows the risk verdict and findings, but
// never the contract text itself or any editing controls.

import Link from "next/link";
import { prisma } from "@/lib/db";
import { BRAND } from "@/lib/legal-info";
import type { Metadata } from "next";

// The link is a private credential — keep these pages out of search.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: `Заключение по договору — ${BRAND.name}`,
};

export const dynamic = "force-dynamic";

interface Risk {
  clauseTitle?: string;
  level?: "critical" | "medium" | "low";
  description?: string;
  consequence?: string;
  recommendation?: string;
  legalReference?: string;
}

const VERDICT: Record<string, { label: string; cls: string }> = {
  sign: {
    label: "Низкий уровень риска",
    cls: "border-success/30 bg-success-light text-success",
  },
  negotiate: {
    label: "Средний уровень риска",
    cls: "border-warning/30 bg-warning-light text-warning",
  },
  do_not_sign: {
    label: "Высокий уровень риска",
    cls: "border-danger/30 bg-danger-light text-danger",
  },
};

const RISK_LEVEL: Record<string, { label: string; cls: string }> = {
  critical: { label: "Критический", cls: "bg-danger-light text-danger" },
  medium: { label: "Средний", cls: "bg-warning-light text-warning" },
  low: { label: "Низкий", cls: "bg-surface text-muted" },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface/30">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-fg">
              ⚖
            </div>
            <span className="text-lg font-bold text-foreground">
              {BRAND.name}
            </span>
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-dark"
          >
            Проверить свой договор
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

function Invalid({ reason }: { reason: string }) {
  return (
    <Shell>
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="mb-2 text-xl font-bold text-foreground">
          Ссылка недействительна
        </h1>
        <p className="mb-6 text-sm text-muted">{reason}</p>
        <Link
          href="/sample-report"
          className="text-sm font-semibold text-primary hover:underline"
        >
          Посмотреть пример заключения →
        </Link>
      </div>
    </Shell>
  );
}

export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const share = await prisma.publicShare.findUnique({
    where: { token },
    include: { document: { include: { analysis: true } } },
  });

  if (!share || share.revoked) {
    return <Invalid reason="Эта ссылка была отозвана автором или не существует." />;
  }
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
    return <Invalid reason="Срок действия ссылки истёк." />;
  }
  if (!share.document.analysis) {
    return <Invalid reason="Анализ по этому договору недоступен." />;
  }

  // Best-effort view counter — never block the render on it.
  await prisma.publicShare
    .update({ where: { id: share.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => undefined);

  const analysis = share.document.analysis;
  let risks: Risk[] = [];
  try {
    risks = JSON.parse(analysis.risks) as Risk[];
  } catch {
    risks = [];
  }
  let metadata: Record<string, unknown> = {};
  try {
    metadata = analysis.metadata
      ? (JSON.parse(analysis.metadata) as Record<string, unknown>)
      : {};
  } catch {
    metadata = {};
  }

  const verdict =
    typeof metadata.verdict === "string"
      ? VERDICT[metadata.verdict]
      : undefined;
  const contractType =
    typeof metadata.contractType === "string" ? metadata.contractType : null;
  const verdictReason =
    typeof metadata.verdictReason === "string"
      ? metadata.verdictReason
      : null;

  return (
    <Shell>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Заключение по договору
        </p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">
          {contractType ?? "Анализ договора"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Автоматический разбор от {BRAND.name}. Это не юридическая
          консультация — ознакомительная оценка рисков.
        </p>

        {/* Verdict */}
        {verdict && (
          <div className={`mt-5 rounded-2xl border p-5 ${verdict.cls}`}>
            <p className="text-lg font-bold">{verdict.label}</p>
            {verdictReason && (
              <p className="mt-1 text-sm opacity-90">{verdictReason}</p>
            )}
          </div>
        )}

        {/* Summary */}
        <div className="mt-5 rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted">
            Краткое заключение
          </h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
            {analysis.summary}
          </p>
        </div>

        {/* Risks */}
        <h2 className="mb-3 mt-6 text-sm font-bold uppercase tracking-wider text-muted">
          Найденные риски ({risks.length})
        </h2>
        {risks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted">
            Существенных рисков не выявлено.
          </p>
        ) : (
          <div className="space-y-3">
            {risks.map((r, i) => {
              const lvl = RISK_LEVEL[r.level ?? "low"] ?? RISK_LEVEL.low;
              return (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${lvl.cls}`}
                    >
                      {lvl.label} риск
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {r.clauseTitle ?? `Пункт ${i + 1}`}
                    </span>
                  </div>
                  {r.description && (
                    <p className="text-sm text-foreground">{r.description}</p>
                  )}
                  {r.consequence && (
                    <p className="mt-1 text-sm text-muted">
                      <span className="font-medium">Чем грозит: </span>
                      {r.consequence}
                    </p>
                  )}
                  {r.recommendation && (
                    <p className="mt-1 text-sm text-muted">
                      <span className="font-medium">Рекомендация: </span>
                      {r.recommendation}
                    </p>
                  )}
                  {r.legalReference && (
                    <p className="mt-1 text-xs text-muted">
                      {r.legalReference}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* CTA */}
        <div className="mt-8 rounded-2xl border border-primary/30 bg-primary-light/40 p-5 text-center">
          <p className="text-sm font-semibold text-foreground">
            Хотите так же разобрать свой договор?
          </p>
          <p className="mt-1 text-sm text-muted">
            {BRAND.name} проверит договор за пару минут и подскажет, что
            исправить до подписания.
          </p>
          <Link
            href="/register"
            className="mt-3 inline-block rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-dark"
          >
            Проверить договор бесплатно
          </Link>
        </div>
      </div>
    </Shell>
  );
}
