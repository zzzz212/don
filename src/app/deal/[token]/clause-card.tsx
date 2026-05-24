"use client";

import { useState } from "react";
import { Check, X, MessageSquare } from "lucide-react";
import { buttonClass } from "@/components/button";

export interface ClauseView {
  id: string;
  ord: number;
  text: string;
  riskLevel: "critical" | "medium" | "low" | "none";
  yourSide: {
    description: string;
    consequence?: string | null;
    recommendation: string;
    legalReference: string;
  } | null;
  theirSide: { theirGain: string; compromise?: string } | null;
  status: "PENDING" | "AGREED" | "DISPUTED" | "RESOLVED";
  actions: Array<{
    id: string;
    kind: string;
    body: string | null;
    createdAt: string;
    participant: {
      id: string;
      role: "SENDER" | "RECEIVER";
      guestName: string | null;
    };
  }>;
}

// Status → editorial accent. AGREED runs a subtle sage left-rule;
// DISPUTED a terracotta one. PENDING stays neutral so the page reads
// like an unmarked contract until votes start landing.
const STATUS_ACCENT: Record<ClauseView["status"], string> = {
  PENDING: "border-l-rule",
  AGREED: "border-l-success/60",
  DISPUTED: "border-l-primary/70",
  RESOLVED: "border-l-success/60",
};

const STATUS_LABEL: Record<ClauseView["status"], { text: string; cls: string } | null> = {
  PENDING: null,
  AGREED: { text: "Согласовано", cls: "text-success" },
  DISPUTED: { text: "Спорный пункт", cls: "text-primary" },
  RESOLVED: { text: "Решено", cls: "text-success" },
};

// Format a 0-based ordinal as a clause number with the leading zero of
// a Roman-numeral feel — works as marginalia (§ 01, § 02, …).
function clauseLabel(ord: number): string {
  const n = ord + 1;
  return n < 10 ? `0${n}` : String(n);
}

export function ClauseCard({
  clause,
  myParticipantId,
  onAction,
}: {
  clause: ClauseView;
  myParticipantId: string | null;
  onAction: (
    clauseId: string,
    kind: "AGREE" | "DISAGREE" | "COMMENT",
    body?: string
  ) => Promise<void>;
}) {
  const [commentDraft, setCommentDraft] = useState("");
  const myActions = myParticipantId
    ? clause.actions.filter((a) => a.participant.id === myParticipantId)
    : [];
  const lastVote = myActions
    .filter((a) => a.kind === "AGREE" || a.kind === "DISAGREE")
    .at(-1)?.kind;

  const comments = clause.actions.filter((a) => a.kind === "COMMENT");
  const statusLabel = STATUS_LABEL[clause.status];

  return (
    <article
      className={`group border-l-2 ${STATUS_ACCENT[clause.status]} pl-5 sm:pl-7`}
    >
      <div className="grid gap-x-8 gap-y-5 md:grid-cols-[1.4fr_1fr]">
        {/* ── Document column ─────────────────────────────────────── */}
        <div className="relative">
          {/* Marginalia: clause number in tabular serif, sitting in the
              left gutter — like a printed legal opinion. */}
          <div className="flex items-baseline gap-3">
            <span className="font-serif text-xl font-semibold tabular-nums text-foreground/40 leading-none">
              § {clauseLabel(clause.ord)}
            </span>
            {statusLabel && (
              <span
                className={`text-[10px] uppercase tracking-[0.18em] font-semibold ${statusLabel.cls}`}
              >
                {statusLabel.text}
              </span>
            )}
          </div>
          <p className="mt-3 text-[15px] leading-[1.65] text-foreground whitespace-pre-line">
            {clause.text}
          </p>
        </div>

        {/* ── Counter-AI marginalia column ────────────────────────── */}
        <aside className="space-y-4 md:border-l md:border-rule md:pl-7 text-[13px] leading-[1.6]">
          {clause.yourSide && (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] font-semibold text-primary">
                <span className="inline-block h-px w-3 bg-primary" aria-hidden />
                Ваша сторона
              </div>
              <p className="text-ink-quiet">{clause.yourSide.description}</p>
              {clause.yourSide.consequence && (
                <p className="mt-1.5 text-xs italic text-ink-quiet">
                  {clause.yourSide.consequence}
                </p>
              )}
              {clause.yourSide.legalReference && (
                <p className="mt-1.5 text-[11px] font-mono uppercase tracking-wide text-foreground/40">
                  {clause.yourSide.legalReference}
                </p>
              )}
            </div>
          )}
          {clause.theirSide && (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] font-semibold text-accent">
                <span className="inline-block h-px w-3 bg-accent" aria-hidden />
                Другая сторона
              </div>
              <p className="text-ink-quiet">{clause.theirSide.theirGain}</p>
              {clause.theirSide.compromise && (
                <div className="mt-2 border-l border-accent/40 pl-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-accent/80">
                    Компромисс
                  </div>
                  <p className="mt-0.5 text-foreground/85">
                    {clause.theirSide.compromise}
                  </p>
                </div>
              )}
            </div>
          )}
          {!clause.theirSide && clause.yourSide && (
            <p className="italic text-[12px] leading-[1.5] text-ink-quiet/70">
              Counter-AI не сформирован для этого договора. Запустите повторный
              анализ, чтобы получить позицию другой стороны.
            </p>
          )}
        </aside>
      </div>

      {/* ── Action row + thread ──────────────────────────────────── */}
      {(comments.length > 0 || myParticipantId) && (
        <div className="mt-5 pt-4 border-t border-rule">
          {myParticipantId && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void onAction(clause.id, "AGREE")}
                className={
                  lastVote === "AGREE"
                    ? buttonClass({ variant: "primary", size: "sm" })
                    : buttonClass({ variant: "ghost", size: "sm" })
                }
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                Согласен
              </button>
              <button
                type="button"
                onClick={() => void onAction(clause.id, "DISAGREE")}
                className={
                  lastVote === "DISAGREE"
                    ? buttonClass({ variant: "primary", size: "sm" })
                    : buttonClass({ variant: "ghost", size: "sm" })
                }
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Не согласен
              </button>
              <span className="ml-1 inline-flex items-center gap-1 text-xs text-ink-quiet">
                <MessageSquare className="h-3 w-3" aria-hidden="true" />
                {comments.length > 0
                  ? `${comments.length} ${comments.length === 1 ? "комментарий" : comments.length < 5 ? "комментария" : "комментариев"}`
                  : "обсудить"}
              </span>
            </div>
          )}

          {comments.length > 0 && (
            <ul className="mt-3 space-y-2">
              {comments.map((a) => {
                const who =
                  a.participant.guestName ??
                  (a.participant.role === "SENDER"
                    ? "Отправитель"
                    : "Получатель");
                return (
                  <li
                    key={a.id}
                    className="text-[13px] leading-[1.55] text-foreground/85"
                  >
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-primary/80">
                      {who}
                    </span>
                    <span className="ml-2">{a.body}</span>
                  </li>
                );
              })}
            </ul>
          )}

          {myParticipantId && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && commentDraft.trim()) {
                    void onAction(clause.id, "COMMENT", commentDraft).then(
                      () => setCommentDraft("")
                    );
                  }
                }}
                placeholder="Добавить комментарий…"
                className="flex-1 rounded-md border-0 border-b border-rule bg-transparent px-0 py-1.5 text-sm text-foreground placeholder:text-ink-quiet/70 focus:border-primary focus:outline-none focus:ring-0 transition-colors"
              />
              <button
                type="button"
                disabled={!commentDraft.trim()}
                onClick={() => {
                  void onAction(clause.id, "COMMENT", commentDraft).then(() =>
                    setCommentDraft("")
                  );
                }}
                className="text-xs font-semibold text-primary hover:text-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Отправить
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
