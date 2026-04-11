"use client";

import Link from "next/link";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
import { RiskBadge } from "@/components/risk-badge";
import {
  FileText,
  Plus,
  Clock,
  ArrowRight,
  FolderOpen,
  FileSearch,
  TrendingUp,
  Shield,
} from "lucide-react";

const mockDocuments = [
  {
    id: "1",
    fileName: "Договор аренды — ООО Весна.pdf",
    score: 4,
    risksCount: 5,
    topRisk: "critical" as const,
    createdAt: "2 часа назад",
  },
  {
    id: "2",
    fileName: "НДА с подрядчиком Иванов.docx",
    score: 8,
    risksCount: 2,
    topRisk: "low" as const,
    createdAt: "Вчера",
  },
  {
    id: "3",
    fileName: "Договор поставки — ИП Сидоров.pdf",
    score: 6,
    risksCount: 3,
    topRisk: "medium" as const,
    createdAt: "3 дня назад",
  },
];

const quickStats = [
  {
    label: "Проанализировано",
    value: "12",
    icon: FileSearch,
    color: "text-primary",
    bg: "bg-primary-light",
  },
  {
    label: "Средний скоринг",
    value: "6.4",
    icon: TrendingUp,
    color: "text-warning",
    bg: "bg-amber-50",
  },
  {
    label: "Критичных рисков",
    value: "3",
    icon: Shield,
    color: "text-danger",
    bg: "bg-red-50",
  },
];

export default function DashboardPage() {
  return (
    <div className="flex min-h-full flex-col">
      <Header />

      <main className="flex-1 bg-surface/30">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Дашборд</h1>
              <p className="mt-1 text-sm text-muted">
                Обзор ваших документов и анализов
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/templates"
                className="flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
              >
                <FolderOpen className="h-4 w-4" />
                Шаблоны
              </Link>
              <Link
                href="/analyze"
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
              >
                <Plus className="h-4 w-4" />
                Новый анализ
              </Link>
            </div>
          </div>

          {/* Quick stats */}
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            {quickStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}
                  >
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {stat.value}
                    </p>
                    <p className="text-xs text-muted">{stat.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Documents list */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-6 py-4">
              <h2 className="font-semibold text-foreground">
                Последние документы
              </h2>
            </div>
            <div className="divide-y divide-border">
              {mockDocuments.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/report/${doc.id}`}
                  className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-card-hover"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {doc.fileName}
                    </p>
                    <div className="mt-1 flex items-center gap-3">
                      <span className="flex items-center gap-1 text-xs text-muted">
                        <Clock className="h-3 w-3" />
                        {doc.createdAt}
                      </span>
                      <span className="text-xs text-muted">
                        {doc.risksCount} рисков
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <RiskBadge level={doc.topRisk} />
                    <div className="text-right">
                      <span
                        className={`text-lg font-bold ${
                          doc.score >= 7
                            ? "text-success"
                            : doc.score >= 4
                              ? "text-warning"
                              : "text-danger"
                        }`}
                      >
                        {doc.score}/10
                      </span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Disclaimer />
    </div>
  );
}
