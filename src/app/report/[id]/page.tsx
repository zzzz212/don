"use client";

import Link from "next/link";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
import { ScoreRing } from "@/components/score-ring";
import { AnalysisCard, type RiskItem } from "@/components/analysis-card";
import {
  ArrowLeft,
  Download,
  FileText,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

const mockAnalysis = {
  fileName: "Договор аренды — ООО Весна.pdf",
  score: 5,
  summary:
    "Договор содержит несколько существенных рисков, требующих внимания. Обнаружены пункты, которые могут привести к финансовым потерям и ограничению ваших прав как арендатора. Рекомендуется внести правки до подписания.",
  risks: [
    {
      clause: "П. 3.2 — Односторонний отказ от договора",
      level: "critical" as const,
      description:
        "Арендодатель может расторгнуть договор в одностороннем порядке с уведомлением за 15 дней. При этом арендатор такого права лишён. Это создаёт существенный дисбаланс прав сторон.",
      recommendation:
        "Добавить симметричное право арендатора на односторонний отказ. Увеличить срок уведомления до 60 дней для обеих сторон.",
    },
    {
      clause: "П. 5.1 — Автоматическое повышение арендной платы",
      level: "critical" as const,
      description:
        'Арендная плата может быть увеличена арендодателем ежегодно "с учётом рыночных условий" без указания максимального процента. Это позволяет неограниченное повышение.',
      recommendation:
        "Установить максимальный процент годового повышения (например, не более 10% или привязка к индексу ИПЦ). Добавить право арендатора отказаться при повышении сверх лимита.",
    },
    {
      clause: "П. 7.3 — Ответственность за скрытые дефекты",
      level: "medium" as const,
      description:
        "Арендатор принимает помещение «как есть» и берёт на себя расходы по устранению любых недостатков, обнаруженных после подписания акта приёмки.",
      recommendation:
        "Добавить гарантийный период (30-90 дней) для выявления скрытых дефектов. Расходы на устранение скрытых дефектов должны нести арендодатель.",
    },
    {
      clause: "П. 8.2 — Штрафные санкции",
      level: "medium" as const,
      description:
        "Неустойка за просрочку арендной платы составляет 1% в день, что эквивалентно 365% годовых. Это существенно превышает рыночные ставки.",
      recommendation:
        "Снизить размер неустойки до 0.1% в день (36.5% годовых) или привязать к ключевой ставке ЦБ РФ.",
    },
    {
      clause: "П. 10.1 — Подсудность",
      level: "low" as const,
      description:
        "Споры рассматриваются в арбитражном суде по месту нахождения арендодателя. Стандартное условие, но может быть неудобно при разных регионах.",
      recommendation:
        "Если стороны в разных регионах, рассмотреть вариант подсудности по месту нахождения предмета аренды.",
    },
  ] as RiskItem[],
};

export default function ReportPage() {
  const criticalCount = mockAnalysis.risks.filter(
    (r) => r.level === "critical"
  ).length;
  const mediumCount = mockAnalysis.risks.filter(
    (r) => r.level === "medium"
  ).length;
  const lowCount = mockAnalysis.risks.filter((r) => r.level === "low").length;

  return (
    <div className="flex min-h-full flex-col">
      <Header />

      <main className="flex-1 bg-surface/30">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Top bar */}
          <div className="mb-8 flex items-center justify-between">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              К дашборду
            </Link>
            <button className="flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface">
              <Download className="h-4 w-4" />
              Скачать отчёт PDF
            </button>
          </div>

          {/* Report header */}
          <div className="animate-fade-in rounded-2xl border border-border bg-card p-6 sm:p-8">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              <ScoreRing score={mockAnalysis.score} />
              <div className="flex-1 text-center sm:text-left">
                <div className="mb-2 flex items-center justify-center gap-2 sm:justify-start">
                  <FileText className="h-5 w-5 text-muted" />
                  <h1 className="text-lg font-bold text-foreground">
                    {mockAnalysis.fileName}
                  </h1>
                </div>
                <p className="text-sm leading-relaxed text-muted">
                  {mockAnalysis.summary}
                </p>

                {/* Risk counters */}
                <div className="mt-4 flex flex-wrap justify-center gap-4 sm:justify-start">
                  <div className="flex items-center gap-1.5 text-sm">
                    <AlertTriangle className="h-4 w-4 text-danger" />
                    <span className="font-semibold text-danger">
                      {criticalCount}
                    </span>
                    <span className="text-muted">критичных</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <AlertCircle className="h-4 w-4 text-warning" />
                    <span className="font-semibold text-warning">
                      {mediumCount}
                    </span>
                    <span className="text-muted">средних</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span className="font-semibold text-success">
                      {lowCount}
                    </span>
                    <span className="text-muted">низких</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Risk cards */}
          <div className="mt-6 space-y-4">
            <h2 className="text-lg font-bold text-foreground">
              Обнаруженные риски
            </h2>
            {mockAnalysis.risks.map((risk, i) => (
              <AnalysisCard key={i} risk={risk} index={i} />
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="mt-8 rounded-2xl border border-primary/20 bg-primary-light/30 p-6 text-center">
            <p className="font-semibold text-foreground">
              Хотите проверить ещё один договор?
            </p>
            <p className="mt-1 text-sm text-muted">
              У вас осталось 2 бесплатных анализа в этом месяце
            </p>
            <Link
              href="/analyze"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              Загрузить новый договор
            </Link>
          </div>
        </div>
      </main>

      <Disclaimer />
    </div>
  );
}
