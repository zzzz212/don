import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
import { ScoreRing } from "@/components/score-ring";
import { AnalysisCard } from "@/components/analysis-card";
import { SAMPLE_ANALYSIS, SAMPLE_FILE_NAME } from "@/lib/sample-analysis";
import { BRAND } from "@/lib/legal-info";
import {
  FileText,
  Users,
  AlertOctagon,
  AlertTriangle,
  CheckCircle,
  ListChecks,
  ClipboardCheck,
  Stamp,
  Building2,
  ArrowRight,
  Sparkles,
  Info,
} from "lucide-react";

// Public, no-auth preview. The single biggest conversion lever we have:
// a sceptical visitor can read a real-looking report before signing up.
// SEO-indexed (canonical = self, no noindex) so long-tail queries like
// "пример анализа договора" can land here as a first touchpoint.

export const metadata: Metadata = {
  title: `Пример отчёта об анализе договора — ${BRAND.name}`,
  description:
    "Образец отчёта по результатам автоматического аудита договора оказания услуг: 2 критичных риска, 2 средних замечания, готовые формулировки правок со ссылками на ГК РФ.",
  openGraph: {
    title: `Пример отчёта — ${BRAND.name}`,
    description:
      "Реальный пример анализа договора с цитатами из ГК РФ и готовыми правками.",
    type: "article",
  },
  alternates: { canonical: "/sample-report" },
  robots: { index: true, follow: true },
};

export default function SampleReportPage() {
  const analysis = SAMPLE_ANALYSIS;
  const criticalCount = analysis.risks.filter(
    (r) => r.level === "critical"
  ).length;
  const mediumCount = analysis.risks.filter((r) => r.level === "medium").length;
  const lowCount = analysis.risks.filter((r) => r.level === "low").length;

  return (
    <div className="flex min-h-full flex-col">
      <Header />

      <main id="main-content" className="flex-1 bg-surface/30">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Top callout: visitors must instantly know this is a sample,
              and a clear path to upload their own file is one click away.
              Sticky-feeling primary CTA on the right keeps it visible
              while scrolling the report. */}
          <div className="mb-6 flex flex-col items-start gap-4 rounded-2xl border border-primary/30 bg-primary-light/40 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-bold text-foreground">
                  Это пример отчёта — посмотрите, как выглядит результат
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  Договор оказания услуг, типовой для российского IT-рынка.
                  Анализ проведён на модели Claude Sonnet 4.6 с инлайн-справочником
                  из 60+ статей ГК РФ.
                </p>
              </div>
            </div>
            <Link
              href="/analyze"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 transition-colors hover:bg-primary-dark"
            >
              Загрузить свой договор
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Report header — same layout as the real /report page so the
              preview is a faithful preview. */}
          <div className="animate-fade-in rounded-2xl border border-border bg-card p-6 sm:p-8">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              <ScoreRing score={analysis.score} />
              <div className="flex-1 text-center sm:text-left">
                <div className="mb-2 flex items-center justify-center gap-2 sm:justify-start">
                  <FileText className="h-5 w-5 text-muted" />
                  <h1 className="text-lg font-bold text-foreground">
                    {SAMPLE_FILE_NAME}
                  </h1>
                </div>

                <div className="mb-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-primary-light px-2.5 py-1 text-xs font-semibold text-primary-dark">
                    <FileText className="h-3 w-3" />
                    {analysis.contractType}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-surface px-2.5 py-1 text-xs font-medium text-muted">
                    <Users className="h-3 w-3" />
                    {analysis.parties}
                  </span>
                </div>

                <p className="text-sm leading-relaxed text-muted">
                  {analysis.summary}
                </p>

                {/* Verdict callout */}
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger-light p-3 text-left">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger text-white"
                    aria-hidden="true"
                  >
                    <AlertOctagon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-danger">
                      Высокий уровень риска
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-danger/90">
                      {analysis.verdictReason}
                    </p>
                    <p className="mt-2 text-[11px] leading-relaxed text-muted">
                      Это автоматическая оценка по тексту договора, а не
                      юридическая консультация. Перед подписанием значимых
                      сделок проконсультируйтесь со специалистом.
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-[11px] uppercase tracking-wider text-muted">
                  <Info className="mr-1 inline h-3 w-3" /> Демонстрационный
                  отчёт — числа и цитаты сгенерированы для примера, реального
                  юридического лица за ним нет.
                </p>
              </div>
            </div>
          </div>

          {/* Counts row */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-danger/30 bg-danger-light/40 p-4 text-center">
              <p className="text-3xl font-bold tabular-nums text-danger">
                {criticalCount}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-danger/80">
                Критичных
              </p>
            </div>
            <div className="rounded-xl border border-warning/30 bg-warning-light/40 p-4 text-center">
              <p className="text-3xl font-bold tabular-nums text-warning">
                {mediumCount}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-warning/80">
                Средних
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface/40 p-4 text-center">
              <p className="text-3xl font-bold tabular-nums text-muted">
                {lowCount}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">
                Низких
              </p>
            </div>
          </div>

          {/* Risks */}
          <h2 className="mt-10 mb-4 flex items-center gap-2 text-xl font-bold text-foreground">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Найденные риски
          </h2>
          <div className="space-y-4">
            {analysis.risks.map((risk, i) => (
              <AnalysisCard key={i} risk={risk} index={i} />
            ))}
          </div>

          {/* Missing clauses */}
          {analysis.missingClauses && analysis.missingClauses.length > 0 && (
            <section className="mt-10 rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground">
                <ListChecks className="h-5 w-5 text-primary" />
                Отсутствующие пункты
              </h2>
              <ul className="space-y-2">
                {analysis.missingClauses.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-light text-[10px] font-bold text-primary-dark">
                      {i + 1}
                    </span>
                    <span className="text-foreground">{c}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Pre-signing checklist */}
          {analysis.preSigningChecklist &&
            analysis.preSigningChecklist.length > 0 && (
              <section className="mt-6 rounded-2xl border border-border bg-card p-6">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground">
                  <ClipboardCheck className="h-5 w-5 text-success" />
                  Чек-лист до подписания
                </h2>
                <ul className="space-y-2">
                  {analysis.preSigningChecklist.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span className="text-foreground">{c}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

          {/* Notarization + registration */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-2 flex items-center gap-2">
                <Stamp className="h-4 w-4 text-muted" />
                <h3 className="text-sm font-bold text-foreground">
                  Нотариальное удостоверение
                </h3>
              </div>
              <p className="text-xs leading-relaxed text-muted">
                {analysis.notarization?.reason}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-2 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted" />
                <h3 className="text-sm font-bold text-foreground">
                  Государственная регистрация
                </h3>
              </div>
              <p className="text-xs leading-relaxed text-muted">
                {analysis.registration?.reason}
              </p>
            </div>
          </div>

          {/* Bottom CTA. Anyone who scrolled this far has high intent —
              don't make them scroll back up to the top CTA banner. */}
          <section className="mt-12 rounded-3xl bg-gradient-to-br from-primary to-blue-700 px-6 py-12 text-center text-white shadow-xl shadow-primary/20 sm:px-10">
            <h2 className="text-2xl font-bold sm:text-3xl">
              Запустите такой же анализ для своего договора
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-blue-100">
              PDF или DOCX. Через 30–60 секунд — отчёт со ссылками на статьи ГК
              и готовыми формулировками правок. 10 анализов в месяц бесплатно,
              без привязки карты.
            </p>
            <Link
              href="/analyze"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50"
            >
              Загрузить свой договор
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="mt-4 text-xs text-blue-100/70">
              Без регистрации — сразу анализ. Регистрация нужна только чтобы
              сохранить историю и применять правки.
            </p>
          </section>
        </div>
      </main>

      <Disclaimer />
    </div>
  );
}
