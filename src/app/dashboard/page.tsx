"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
import { RiskBadge, type RiskLevel } from "@/components/risk-badge";
import {
  FileText,
  Plus,
  Clock,
  ArrowRight,
  FolderOpen,
  FileSearch,
  TrendingUp,
  Shield,
  Loader2,
  Trash2,
} from "lucide-react";

interface DocumentItem {
  id: string;
  fileName: string;
  score: number;
  risksCount: number;
  topRisk: RiskLevel;
  createdAt: string;
}

interface GeneratedDocItem {
  id: string;
  templateId: string;
  name: string;
  createdAt: string;
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Вчера";
  if (days < 7) return `${days} дн назад`;
  return new Date(date).toLocaleDateString("ru-RU");
}

export default function DashboardPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"analyses" | "generated">("analyses");
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [analysesRes, generatedRes] = await Promise.all([
          fetch("/api/documents"),
          fetch("/api/generated"),
        ]);

        if (analysesRes.ok) {
          const data = await analysesRes.json();
          setDocuments(data);
        }

        if (generatedRes.ok) {
          const data = await generatedRes.json();
          setGeneratedDocs(data);
        }
      } catch {
        // silently fail — show empty state
      }
      setLoading(false);
    }
    loadData();
  }, []);

  async function deleteDocument(id: string, type: "analysis" | "generated") {
    if (!confirm("Вы уверены? Документ будет удален.")) return;

    setDeleting(id);
    try {
      const endpoint =
        type === "analysis" ? `/api/documents/${id}` : `/api/generated/${id}`;
      const response = await fetch(endpoint, { method: "DELETE" });

      if (response.ok) {
        if (type === "analysis") {
          setDocuments((prev) => prev.filter((d) => d.id !== id));
        } else {
          setGeneratedDocs((prev) => prev.filter((d) => d.id !== id));
        }
      }
    } catch {
      alert("Ошибка при удалении документа");
    } finally {
      setDeleting(null);
    }
  }

  const totalDocs = documents.length;
  const avgScore =
    totalDocs > 0
      ? (documents.reduce((sum, d) => sum + d.score, 0) / totalDocs).toFixed(1)
      : "—";
  const criticalCount = documents.filter((d) => d.topRisk === "critical").length;

  const quickStats = [
    {
      label: "Проанализировано",
      value: String(totalDocs),
      icon: FileSearch,
      color: "text-primary",
      bg: "bg-primary-light",
    },
    {
      label: "Средний скоринг",
      value: avgScore,
      icon: TrendingUp,
      color: "text-warning",
      bg: "bg-amber-50",
    },
    {
      label: "С критичными рисками",
      value: String(criticalCount),
      icon: Shield,
      color: "text-danger",
      bg: "bg-red-50",
    },
  ];

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

          {/* Tabs */}
          <div className="mb-8 flex gap-4 border-b border-border">
            <button
              onClick={() => setTab("analyses")}
              className={`px-4 py-3 font-semibold transition-colors ${
                tab === "analyses"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Анализы договоров
            </button>
            <button
              onClick={() => setTab("generated")}
              className={`px-4 py-3 font-semibold transition-colors ${
                tab === "generated"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Созданные документы
            </button>
          </div>

          {/* Documents list */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-6 py-4">
              <h2 className="font-semibold text-foreground">
                {tab === "analyses"
                  ? "Проанализированные договоры"
                  : "Сгенерированные документы"}
              </h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : tab === "analyses" ? (
              documents.length === 0 ? (
                <div className="py-12 text-center">
                  <FileText className="mx-auto h-10 w-10 text-muted/40 mb-3" />
                  <p className="text-muted font-medium">
                    Пока нет проанализированных документов
                  </p>
                  <p className="text-sm text-muted/70 mt-1">
                    Загрузите первый договор для анализа
                  </p>
                  <Link
                    href="/analyze"
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
                  >
                    <Plus className="h-4 w-4" />
                    Анализировать договор
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-card-hover"
                    >
                      <Link
                        href={`/report/${doc.id}`}
                        className="flex flex-1 items-center gap-4"
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
                              {timeAgo(doc.createdAt)}
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
                      <button
                        onClick={() => deleteDocument(doc.id, "analysis")}
                        disabled={deleting === doc.id}
                        className="shrink-0 p-2 text-muted transition-colors hover:text-danger disabled:opacity-50"
                        title="Удалить анализ"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )
            ) : generatedDocs.length === 0 ? (
              <div className="py-12 text-center">
                <FileText className="mx-auto h-10 w-10 text-muted/40 mb-3" />
                <p className="text-muted font-medium">
                  Пока нет созданных документов
                </p>
                <p className="text-sm text-muted/70 mt-1">
                  Создайте первый документ из шаблона
                </p>
                <Link
                  href="/templates"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
                >
                  <Plus className="h-4 w-4" />
                  Создать документ
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {generatedDocs.map((doc) => (
                  <Link
                    key={doc.id}
                    href={`/generated/${doc.id}`}
                    className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-card-hover group"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {doc.name}
                      </p>
                      <div className="mt-1 flex items-center gap-3">
                        <span className="flex items-center gap-1 text-xs text-muted">
                          <Clock className="h-3 w-3" />
                          {timeAgo(doc.createdAt)}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <Disclaimer />
    </div>
  );
}
