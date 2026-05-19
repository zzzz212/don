"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ScoreRing } from "@/components/score-ring";
import { AnalysisCard, type RiskItem } from "@/components/analysis-card";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Check,
  X,
  Send,
  Copy,
  FileText,
  MessageSquare,
  CheckCircle2,
} from "lucide-react";

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: { userId: string; displayName: string; image: string | null };
  mine: boolean;
}

interface ShareDetail {
  id: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "COMPLETED";
  message: string | null;
  createdAt: string;
  role: "sender" | "reviewer";
  from: { displayName: string };
  to: { displayName: string };
  document: {
    fileName: string;
    rawText: string;
    score: number | null;
    summary: string | null;
    risks: RiskItem[];
    metadata: { contractType?: string };
  } | null;
  comments: Comment[];
}

const STATUS_LABEL: Record<ShareDetail["status"], string> = {
  PENDING: "Ожидает ответа рецензента",
  ACCEPTED: "На ревью",
  DECLINED: "Отклонено",
  COMPLETED: "Ревью завершено",
};

const STATUS_CLASS: Record<ShareDetail["status"], string> = {
  PENDING: "bg-warning-light text-warning",
  ACCEPTED: "bg-primary-light text-primary-dark",
  DECLINED: "bg-surface text-muted",
  COMPLETED: "bg-success-light text-success",
};

export default function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [share, setShare] = useState<ShareDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    void load();
  }, [id]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/network/shares/${id}`);
      if (!r.ok) {
        setError((await r.json()).error ?? "Ревью не найдено");
        return;
      }
      setShare(await r.json());
    } catch {
      setError("Не удалось загрузить ревью");
    } finally {
      setLoading(false);
    }
  }

  async function respond(action: "accept" | "decline" | "complete") {
    setBusy(true);
    try {
      const r = await fetch(`/api/network/shares/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (r.ok) await load();
      else setError((await r.json()).error ?? "Не удалось обновить ревью");
    } finally {
      setBusy(false);
    }
  }

  async function sendComment() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      const r = await fetch(`/api/network/shares/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (r.ok) {
        const { comment } = await r.json();
        setShare((s) =>
          s ? { ...s, comments: [...s.comments, comment] } : s
        );
        setDraft("");
      } else {
        setError((await r.json()).error ?? "Не удалось отправить комментарий");
      }
    } finally {
      setSending(false);
    }
  }

  async function copyToWorkspace() {
    setBusy(true);
    try {
      const r = await fetch(`/api/network/shares/${id}/copy`, {
        method: "POST",
      });
      if (r.ok) {
        const { documentId } = await r.json();
        router.push(`/report/${documentId}`);
      } else {
        setError((await r.json()).error ?? "Не удалось скопировать документ");
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
          <Loader2 className="h-8 w-8 animate-spin text-muted" />
        </AppShell>
    );
  }

  if (error || !share) {
    return (
      <AppShell>
          <div className="text-center">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-warning" />
            <p className="mb-4 text-muted">{error ?? "Ревью не найдено"}</p>
            <Link
              href="/network"
              className="text-sm font-semibold text-primary hover:underline"
            >
              К сети
            </Link>
          </div>
        </AppShell>
    );
  }

  const isReviewer = share.role === "reviewer";
  const canCopy =
    isReviewer &&
    (share.status === "ACCEPTED" || share.status === "COMPLETED");

  return (
    <AppShell>
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href="/network"
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />К сети
          </Link>

          {/* Header card */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[share.status]}`}
              >
                {STATUS_LABEL[share.status]}
              </span>
              <span className="text-xs text-muted">
                {isReviewer
                  ? `На ревью от: ${share.from.displayName}`
                  : `Рецензент: ${share.to.displayName}`}
              </span>
            </div>
            <h1 className="flex items-center gap-2 text-lg font-bold text-foreground">
              <FileText className="h-5 w-5 shrink-0 text-muted" />
              {share.document?.fileName ?? "Документ"}
            </h1>
            {share.message && (
              <p className="mt-2 rounded-lg bg-surface p-3 text-sm italic text-muted">
                «{share.message}»
              </p>
            )}

            {/* Workflow actions */}
            <div className="mt-4 flex flex-wrap gap-2">
              {isReviewer && share.status === "PENDING" && (
                <>
                  <button
                    type="button"
                    onClick={() => respond("accept")}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-dark disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    Принять на ревью
                  </button>
                  <button
                    type="button"
                    onClick={() => respond("decline")}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Отклонить
                  </button>
                </>
              )}
              {share.status === "ACCEPTED" && (
                <button
                  type="button"
                  onClick={() => respond("complete")}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-success/40 bg-success-light px-4 py-2 text-sm font-semibold text-success transition-colors hover:bg-success-light/70 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Завершить ревью
                </button>
              )}
              {canCopy && (
                <button
                  type="button"
                  onClick={copyToWorkspace}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  Скопировать в своё пространство
                </button>
              )}
            </div>
          </div>

          {/* Analysis */}
          {share.document && (
            <div className="mt-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
              <div className="flex items-start gap-4">
                {share.document.score != null && (
                  <ScoreRing score={share.document.score} />
                )}
                <div className="min-w-0 flex-1">
                  {share.document.metadata.contractType && (
                    <span className="inline-block rounded-md bg-primary-light px-2 py-0.5 text-xs font-semibold text-primary-dark">
                      {share.document.metadata.contractType}
                    </span>
                  )}
                  {share.document.summary && (
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      {share.document.summary}
                    </p>
                  )}
                </div>
              </div>

              {share.document.risks.length > 0 && (
                <div className="mt-5 space-y-3">
                  <h2 className="text-sm font-bold text-foreground">
                    Риски ({share.document.risks.length})
                  </h2>
                  {share.document.risks.map((risk, i) => (
                    <AnalysisCard key={i} risk={risk} index={i} />
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowText((v) => !v)}
                className="mt-4 text-sm font-medium text-primary hover:underline"
              >
                {showText ? "Скрыть текст договора" : "Показать текст договора"}
              </button>
              {showText && (
                <pre className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-surface p-3 text-xs leading-relaxed text-foreground">
                  {share.document.rawText}
                </pre>
              )}
            </div>
          )}

          {/* Comment thread */}
          <div className="mt-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
              <MessageSquare className="h-4 w-4 text-muted" />
              Обсуждение ({share.comments.length})
            </h2>
            <div className="space-y-3">
              {share.comments.length === 0 && (
                <p className="text-sm text-muted">
                  Пока нет комментариев. Напишите рецензенту или автору.
                </p>
              )}
              {share.comments.map((c) => (
                <div
                  key={c.id}
                  className={`flex flex-col ${c.mine ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                      c.mine
                        ? "bg-primary text-primary-fg"
                        : "bg-surface text-foreground"
                    }`}
                  >
                    {!c.mine && (
                      <p className="mb-0.5 text-xs font-semibold opacity-80">
                        {c.author.displayName}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {c.body}
                    </p>
                  </div>
                  <span className="mt-0.5 text-[11px] text-muted">
                    {new Date(c.createdAt).toLocaleString("ru-RU", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>

            {share.status !== "DECLINED" && (
              <div className="mt-4 flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  placeholder="Написать комментарий…"
                  className="flex-1 resize-y rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={sendComment}
                  disabled={sending || draft.trim().length === 0}
                  aria-label="Отправить комментарий"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-fg transition-colors hover:bg-primary-dark disabled:opacity-50"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </AppShell>
  );
}
