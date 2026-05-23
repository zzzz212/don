"use client";

import { useState } from "react";
import { Button } from "@/components/button";

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

const STATUS_STYLES: Record<ClauseView["status"], string> = {
  PENDING: "border-border bg-card",
  AGREED: "border-emerald-700/30 bg-emerald-50/40",
  DISPUTED: "border-rose-700/30 bg-rose-50/40",
  RESOLVED: "border-emerald-700/30 bg-emerald-50/40",
};

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

  return (
    <div className={`rounded-lg border p-5 ${STATUS_STYLES[clause.status]}`}>
      <div className="grid gap-4 md:grid-cols-2">
        {/* Left column — clause text */}
        <div>
          <div className="text-xs uppercase tracking-wider text-muted mb-2">
            Пункт {clause.ord + 1}
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-line">
            {clause.text}
          </p>
        </div>

        {/* Right column — AI analysis */}
        <div className="space-y-3 text-sm">
          {clause.yourSide && (
            <div>
              <div className="font-medium text-primary mb-1">Ваша сторона</div>
              <p className="text-foreground/80">{clause.yourSide.description}</p>
              {clause.yourSide.consequence && (
                <p className="text-xs text-foreground/70 mt-1">
                  ⚠ {clause.yourSide.consequence}
                </p>
              )}
            </div>
          )}
          {clause.theirSide && (
            <div>
              {/* Sage accent for the other party */}
              <div
                className="font-medium mb-1"
                style={{ color: "#6E7F62" }}
              >
                Другая сторона
              </div>
              <p className="text-foreground/80">{clause.theirSide.theirGain}</p>
              {clause.theirSide.compromise && (
                <p className="text-xs mt-1">
                  💡 Компромисс: {clause.theirSide.compromise}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action row */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button
          size="sm"
          variant={lastVote === "AGREE" ? "primary" : "ghost"}
          onClick={() => void onAction(clause.id, "AGREE")}
          disabled={!myParticipantId}
        >
          ✓ Согласен
        </Button>
        <Button
          size="sm"
          variant={lastVote === "DISAGREE" ? "primary" : "ghost"}
          onClick={() => void onAction(clause.id, "DISAGREE")}
          disabled={!myParticipantId}
        >
          ✗ Не согласен
        </Button>
      </div>

      {/* Comment thread */}
      {clause.actions.filter((a) => a.kind === "COMMENT").length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {clause.actions
            .filter((a) => a.kind === "COMMENT")
            .map((a) => (
              <li key={a.id} className="text-foreground/80">
                <strong>
                  {a.participant.guestName ??
                    (a.participant.role === "SENDER"
                      ? "Отправитель"
                      : "Получатель")}
                  :
                </strong>{" "}
                {a.body}
              </li>
            ))}
        </ul>
      )}

      {/* Comment input — only shown when user has a participant identity */}
      {myParticipantId && (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && commentDraft.trim()) {
                void onAction(clause.id, "COMMENT", commentDraft).then(() =>
                  setCommentDraft("")
                );
              }
            }}
            placeholder="Оставить комментарий…"
            className="flex-1 rounded border border-border bg-card px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button
            size="sm"
            variant="ghost"
            disabled={!commentDraft.trim()}
            onClick={() => {
              void onAction(clause.id, "COMMENT", commentDraft).then(() =>
                setCommentDraft("")
              );
            }}
          >
            Отправить
          </Button>
        </div>
      )}
    </div>
  );
}
