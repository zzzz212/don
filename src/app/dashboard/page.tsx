"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
import { RiskBadge, type RiskLevel } from "@/components/risk-badge";
import { UsageWidget } from "@/components/usage-widget";
import { DocumentSearchBar } from "@/components/document-search-bar";
import { DocumentRowSkeleton } from "@/components/skeleton";
import { useToast } from "@/components/toast";
import { buttonClass } from "@/components/button";
import {
  EmptyState,
  DocsEmptyIllustration,
} from "@/components/empty-state";
import {
  FileText,
  Plus,
  Clock,
  ArrowRight,
  FolderOpen,
  FileSearch,
  TrendingUp,
  Shield,
  Trash2,
  Download,
  MessageCircle,
  Building2,
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
  const toast = useToast();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"analyses" | "generated">("analyses");
  const [deleting, setDeleting] = useState<string | null>(null);
  // Keyboard cursor for j/k navigation. -1 = nothing focused.
  const [cursor, setCursor] = useState(-1);

  // j / k / arrow nav across the active tab's list. Enter opens. Skipped
  // when the user is typing in any input — same heuristic as the ⌘K
  // palette so the two don't fight over the keystroke.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const list = tab === "analyses" ? documents : generatedDocs;
      if (list.length === 0) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, list.length - 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === "Enter" && cursor >= 0 && cursor < list.length) {
        const item = list[cursor];
        const href =
          tab === "analyses"
            ? `/report/${(item as DocumentItem).id}`
            : `/generated/${(item as GeneratedDocItem).id}`;
        window.location.href = href;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [tab, documents, generatedDocs, cursor]);

  // Reset cursor when the user switches tabs — the indices don't carry
  // semantic meaning across lists.
  useEffect(() => {
    setCursor(-1);
  }, [tab]);

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

  // Optimistic delete with a 5-second undo window. The row vanishes
  // immediately; the actual DELETE call only fires once the undo toast
  // expires. Clicking "Отменить" restores the row and the request never
  // hits the server. Same pattern Gmail / Linear use — feels like
  // sub-second response and protects against fat-finger deletions.
  function deleteDocument(id: string, type: "analysis" | "generated") {
    const endpoint =
      type === "analysis" ? `/api/documents/${id}` : `/api/generated/${id}`;
    const list = type === "analysis" ? documents : generatedDocs;
    const removed = list.find((d) => d.id === id);
    if (!removed) return;
    const removedIndex = list.findIndex((d) => d.id === id);

    // Hide locally.
    if (type === "analysis") {
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } else {
      setGeneratedDocs((prev) => prev.filter((d) => d.id !== id));
    }

    let cancelled = false;
    const restore = () => {
      cancelled = true;
      if (type === "analysis") {
        setDocuments((prev) => {
          const next = prev.slice();
          next.splice(
            Math.min(removedIndex, next.length),
            0,
            removed as DocumentItem
          );
          return next;
        });
      } else {
        setGeneratedDocs((prev) => {
          const next = prev.slice();
          next.splice(
            Math.min(removedIndex, next.length),
            0,
            removed as GeneratedDocItem
          );
          return next;
        });
      }
    };

    toast.success("Документ удалён", {
      durationMs: 5000,
      action: { label: "Отменить", onClick: restore },
    });

    setTimeout(async () => {
      if (cancelled) return;
      try {
        const response = await fetch(endpoint, { method: "DELETE" });
        if (!response.ok) {
          toast.error("Не удалось удалить — восстановили в списке");
          restore();
        }
      } catch {
        toast.error("Сеть недоступна — документ восстановлен");
        restore();
      }
    }, 5100);
  }

  async function downloadDocument(id: string, name: string) {
    try {
      const response = await fetch(`/api/generated/${id}`);
      if (!response.ok) throw new Error("Document not found");

      const doc = await response.json();

      const docxResponse = await fetch("/api/export/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: name,
          content: doc.content,
        }),
      });

      if (docxResponse.ok) {
        const blob = await docxResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${name}.docx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Error downloading document:", error);
      toast.error("Не удалось скачать DOCX. Попробуйте ещё раз.");
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
      bg: "bg-warning-light",
    },
    {
      label: "С критичными рисками",
      value: String(criticalCount),
      icon: Shield,
      color: "text-danger",
      bg: "bg-danger-light",
    },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <Header />

      <main id="main-content" className="flex-1 bg-surface/30">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Дашборд</h1>
              <p className="mt-1 text-sm text-muted">
                Обзор ваших документов и анализов
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Link
                href="/templates"
                className={buttonClass({
                  variant: "secondary",
                  className: "flex-1 sm:flex-none",
                })}
              >
                <FolderOpen className="h-4 w-4" aria-hidden="true" />
                Шаблоны
              </Link>
              <Link
                href="/analyze"
                className={buttonClass({ className: "flex-1 sm:flex-none" })}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Новый анализ
              </Link>
            </div>
          </div>

          {/* Search across user's archive */}
          <div className="mb-6">
            <DocumentSearchBar />
          </div>

          {/* Usage widget */}
          <div className="mb-6">
            <UsageWidget />
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
                    <p className="text-2xl font-semibold text-foreground">
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
              <div className="divide-y divide-border">
                {Array.from({ length: 4 }).map((_, i) => (
                  <DocumentRowSkeleton key={i} />
                ))}
              </div>
            ) : tab === "analyses" ? (
              documents.length === 0 ? (
                <EmptyState
                  illustration={<DocsEmptyIllustration />}
                  title="Загрузите первый договор"
                  description="Модель пройдёт по тексту со справочником ГК РФ — найдёт несоразмерные штрафы, кабальные условия и пропущенные существенные пункты. Поддерживаются PDF и DOCX, а на «Про» — даже сканы. Не готовы загружать свой? Откройте пример отчёта."
                  actions={
                    <>
                      <Link
                        href="/analyze"
                        className={buttonClass()}
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Анализировать договор
                      </Link>
                      <Link
                        href="/sample-report"
                        className={buttonClass({ variant: "secondary" })}
                      >
                        <FileText className="h-4 w-4" aria-hidden="true" />
                        Посмотреть пример отчёта
                      </Link>
                      <Link
                        href="/chat"
                        className={buttonClass({ variant: "secondary" })}
                      >
                        <MessageCircle className="h-4 w-4" aria-hidden="true" />
                        Спросить AI-юриста
                      </Link>
                    </>
                  }
                />
              ) : (
                <div className="divide-y divide-border">
                  {documents.map((doc, idx) => (
                    <div
                      key={doc.id}
                      data-active={cursor === idx}
                      className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-card-hover data-[active=true]:bg-card-hover data-[active=true]:ring-1 data-[active=true]:ring-inset data-[active=true]:ring-primary/20 sm:gap-4 sm:px-6"
                    >
                      <Link
                        href={`/report/${doc.id}`}
                        className="flex min-w-0 flex-1 items-center gap-4"
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
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-danger disabled:opacity-50"
                        aria-label="Удалить анализ"
                        title="Удалить анализ"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )
            ) : generatedDocs.length === 0 ? (
              <EmptyState
                illustration={<DocsEmptyIllustration />}
                title="Создайте первый документ из шаблона"
                description="20 готовых шаблонов: NDA, аренда, услуги, поставка, заём, трудовой и другие. Заполните форму — получите DOCX, юридически грамотный и готовый к подписанию."
                actions={
                  <Link
                    href="/templates"
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-dark"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Открыть шаблоны
                  </Link>
                }
              />
            ) : (
              <div className="divide-y divide-border">
                {generatedDocs.map((doc, idx) => (
                  <div
                    key={doc.id}
                    data-active={cursor === idx}
                    className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-card-hover data-[active=true]:bg-card-hover data-[active=true]:ring-1 data-[active=true]:ring-inset data-[active=true]:ring-primary/20 sm:gap-4 sm:px-6 group"
                  >
                    <Link
                      href={`/generated/${doc.id}`}
                      className="flex min-w-0 flex-1 items-center gap-4"
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
                    <button
                      onClick={() => downloadDocument(doc.id, doc.name)}
                      className="shrink-0 p-2 text-muted transition-colors hover:text-primary"
                      title="Скачать DOCX"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteDocument(doc.id, "generated")}
                      disabled={deleting === doc.id}
                      className="shrink-0 p-2 text-muted transition-colors hover:text-danger disabled:opacity-50"
                      title="Удалить документ"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
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
