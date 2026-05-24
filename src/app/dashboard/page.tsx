"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
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
  Trash2,
  Download,
  MessageCircle,
  Handshake,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DealRoomIllustration } from "@/components/deal-room-illustration";

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

interface ActiveDealItem {
  id: string;
  title: string;
  status: string;
  inviteToken: string;
  clauseCount: number;
  receiver: {
    guestName: string | null;
    guestEmail: string | null;
    lastSeenAt: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
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

function receiverLine(receiver: ActiveDealItem["receiver"]): string {
  if (!receiver?.lastSeenAt) return "Ссылка ещё не открыта";
  const name = receiver.guestName ?? "гость";
  return `${name} · открыто ${timeAgo(receiver.lastSeenAt)}`;
}

function sentinelTone(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return "bg-primary"; // terracotta — needs attention
  const seenMs = new Date(lastSeenAt).getTime();
  const ageHours = (Date.now() - seenMs) / 3_600_000;
  if (ageHours < 24) return "bg-success"; // sage — active dialogue
  return "bg-foreground/30"; // neutral — opened but quiet
}

export default function DashboardPage() {
  const toast = useToast();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDocItem[]>([]);
  const [activeDeals, setActiveDeals] = useState<ActiveDealItem[]>([]);
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

  useEffect(() => {
    setCursor(-1);
  }, [tab]);

  useEffect(() => {
    async function loadData() {
      try {
        const [analysesRes, generatedRes, dealsRes] = await Promise.all([
          fetch("/api/documents"),
          fetch("/api/generated"),
          fetch("/api/deals"),
        ]);
        if (analysesRes.ok) setDocuments(await analysesRes.json());
        if (generatedRes.ok) setGeneratedDocs(await generatedRes.json());
        if (dealsRes.ok) {
          const dealsData = (await dealsRes.json()) as { deals: ActiveDealItem[] };
          // Only show ACTIVE deals in the dashboard section — completed
          // deals are accessible via /deal/[token] directly.
          setActiveDeals(dealsData.deals.filter((d) => d.status === "ACTIVE"));
        }
      } catch {
        // silently fail — show empty state
      }
      setLoading(false);
    }
    loadData();
  }, []);

  // Optimistic delete with a 5-second undo window — see notes in the
  // previous implementation; pattern unchanged.
  function deleteDocument(id: string, type: "analysis" | "generated") {
    const endpoint =
      type === "analysis" ? `/api/documents/${id}` : `/api/generated/${id}`;
    const list = type === "analysis" ? documents : generatedDocs;
    const removed = list.find((d) => d.id === id);
    if (!removed) return;
    const removedIndex = list.findIndex((d) => d.id === id);

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
        body: JSON.stringify({ title: name, content: doc.content }),
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

  const stats = [
    { label: "Проанализировано", value: String(totalDocs) },
    { label: "Средний скоринг", value: avgScore },
    { label: "С критичными рисками", value: String(criticalCount) },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Дашборд"
        description="Анализы и документы рабочего пространства"
        actions={
          <>
            <Link
              href="/templates"
              className={buttonClass({ variant: "secondary" })}
            >
              <FolderOpen className="h-4 w-4" aria-hidden="true" />
              Шаблоны
            </Link>
            <Link href="/analyze" className={buttonClass()}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Новый анализ
            </Link>
          </>
        }
      />

      <div className="space-y-5 px-6 py-6 sm:px-8">
        {/* KPI strip — compact inline row instead of three full-width
            cards. Each metric is a single line: value (serif) + dim
            label, separated by dots on wide screens, stacked on narrow. */}
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
          {stats.map((s, i) => (
            <span key={s.label} className="inline-flex items-baseline gap-2">
              <span className="font-serif text-xl font-semibold leading-none text-foreground tabular-nums">
                {s.value}
              </span>
              <span className="text-muted">{s.label.toLowerCase()}</span>
              {i < stats.length - 1 && (
                <span aria-hidden="true" className="hidden text-muted/40 sm:inline">
                  ·
                </span>
              )}
            </span>
          ))}
        </div>

        {/* Search + plan usage */}
        <DocumentSearchBar />
        <UsageWidget />

        {/* Active Deal Rooms — promotes the new Sprint 14 flagship.
            When the user has deals: list them with editorial spacing.
            When they have analysed contracts but no deals yet: surface
            the bespoke illustration + a single-line invitation. The
            promo is suppressed for first-time users (no documents at
            all) — they need to upload a contract first, no point
            promoting an action that requires one. */}
        {!loading && activeDeals.length > 0 && (
          <section>
            <p className="text-[10px] uppercase tracking-[0.22em] text-ink-quiet">
              Активные сделки
            </p>
            <h2 className="mt-1 mb-4 font-serif text-xl font-semibold tracking-tight text-foreground">
              Идут согласования
            </h2>
            <ul className="space-y-2">
              {activeDeals.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center gap-4 rounded-xl border border-rule bg-card px-5 py-3.5 transition-colors hover:bg-card/80"
                >
                  <span
                    aria-hidden="true"
                    className={`mt-2 h-1.5 w-1.5 shrink-0 self-start rounded-full ${sentinelTone(
                      d.receiver?.lastSeenAt
                    )}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">
                      {d.title}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-quiet">
                      {receiverLine(d.receiver)} ·{" "}
                      {d.clauseCount}{" "}
                      {d.clauseCount === 1
                        ? "пункт"
                        : d.clauseCount < 5
                          ? "пункта"
                          : "пунктов"}
                    </div>
                  </div>
                  <Link
                    href={`/deal/${d.inviteToken}`}
                    className="ml-auto shrink-0 text-sm font-semibold text-foreground transition-colors hover:text-primary underline-offset-4 hover:underline"
                  >
                    Открыть →
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* No deals yet, but the user has analysed something — invite
            them to send their first deal. Bespoke illustration sells
            the feature without taking over the dashboard. */}
        {!loading && activeDeals.length === 0 && documents.length > 0 && (
          <section className="paper-grain overflow-hidden rounded-2xl border border-rule bg-card">
            <div className="grid items-center gap-4 px-6 py-5 sm:grid-cols-[1fr_auto] sm:gap-8 sm:px-8 sm:py-6">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-ink-quiet">
                  Sprint 14 · Deal Room
                </p>
                <h2 className="mt-1.5 font-serif text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  Отправьте первый договор на согласование
                </h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-quiet">
                  Контрагент откроет ссылку без регистрации, увидит ваш разбор
                  и сможет принимать пункты или предлагать правки. Логин и
                  e‑mail с его стороны не нужны.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/report/${documents[0].id}`}
                    className={buttonClass({ variant: "primary", size: "sm" })}
                  >
                    <Handshake className="h-3.5 w-3.5" aria-hidden="true" />
                    Открыть отчёт и отправить
                  </Link>
                  <span className="text-[11px] uppercase tracking-[0.18em] text-ink-quiet">
                    или из <Link href="/analyze" className="text-foreground underline-offset-4 hover:underline">нового анализа</Link>
                  </span>
                </div>
              </div>
              <div
                className="hidden text-foreground sm:block sm:w-56 lg:w-72"
                aria-hidden="true"
              >
                <DealRoomIllustration className="h-auto w-full" />
              </div>
            </div>
          </section>
        )}

        {/* Tabs — underline-only, ink-coloured active line (the brand-
            blue underline was too "marketing" for an app screen). */}
        <div className="flex items-end gap-6 border-b border-border">
          <button
            type="button"
            onClick={() => setTab("analyses")}
            aria-current={tab === "analyses" ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-1 py-3 text-sm font-semibold transition-colors",
              tab === "analyses"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            )}
          >
            Анализы договоров
          </button>
          <button
            type="button"
            onClick={() => setTab("generated")}
            aria-current={tab === "generated" ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-1 py-3 text-sm font-semibold transition-colors",
              tab === "generated"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            )}
          >
            Созданные документы
          </button>
        </div>

        {/* Documents list */}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
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
                    <Link href="/analyze" className={buttonClass()}>
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
                    className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-card-hover data-[active=true]:bg-card-hover data-[active=true]:ring-1 data-[active=true]:ring-inset data-[active=true]:ring-foreground/10 sm:px-5"
                  >
                    <Link
                      href={`/report/${doc.id}`}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <FileText
                        className="h-4 w-4 shrink-0 text-muted"
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {doc.fileName}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {timeAgo(doc.createdAt)} · {doc.risksCount} рисков
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <RiskBadge level={doc.topRisk} />
                        <span
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            doc.score >= 7
                              ? "text-success"
                              : doc.score >= 4
                                ? "text-warning"
                                : "text-danger"
                          )}
                        >
                          {doc.score}
                          <span className="text-muted">/10</span>
                        </span>
                        <ArrowRight
                          className="h-3.5 w-3.5 text-muted opacity-0 transition-opacity group-hover:opacity-100"
                          aria-hidden="true"
                        />
                      </div>
                    </Link>
                    <button
                      onClick={() => deleteDocument(doc.id, "analysis")}
                      disabled={deleting === doc.id}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted opacity-0 transition-all hover:bg-surface hover:text-danger group-hover:opacity-100 disabled:opacity-50"
                      aria-label="Удалить анализ"
                      title="Удалить анализ"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
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
                <Link href="/templates" className={buttonClass()}>
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
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-card-hover data-[active=true]:bg-card-hover data-[active=true]:ring-1 data-[active=true]:ring-inset data-[active=true]:ring-foreground/10 sm:gap-4 sm:px-6"
                >
                  <Link
                    href={`/generated/${doc.id}`}
                    className="flex min-w-0 flex-1 items-center gap-4"
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface text-muted"
                      aria-hidden="true"
                    >
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {doc.name}
                      </p>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {timeAgo(doc.createdAt)}
                        </span>
                      </div>
                    </div>
                    <ArrowRight
                      className="h-4 w-4 text-muted"
                      aria-hidden="true"
                    />
                  </Link>
                  <button
                    onClick={() => downloadDocument(doc.id, doc.name)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground"
                    aria-label="Скачать DOCX"
                    title="Скачать DOCX"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => deleteDocument(doc.id, "generated")}
                    disabled={deleting === doc.id}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-danger disabled:opacity-50"
                    aria-label="Удалить документ"
                    title="Удалить документ"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
