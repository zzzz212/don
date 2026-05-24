"use client";

import { useState } from "react";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/skeleton";
import type { Move, Moves } from "@/lib/ai/schemas/negotiation";

interface Props {
  dealId: string | null;     // sender perspective — set
  token: string | null;       // receiver perspective — set
  clauseId: string;
  myRole: "SENDER" | "RECEIVER";
  onApplyAccept: () => void;  // posts AGREE
  onApplyCompromise: (proposedText: string) => void;  // posts PROPOSE_EDIT
  onApplyStand: (rationale: string) => void;          // posts COMMENT
}

export function NegotiationMoves({
  dealId,
  token,
  clauseId,
  myRole,
  onApplyAccept,
  onApplyCompromise,
  onApplyStand,
}: Props) {
  const [moves, setMoves] = useState<Move[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url =
    myRole === "SENDER" && dealId
      ? `/api/deals/${dealId}/clauses/${clauseId}/suggest-moves`
      : token
        ? `/api/deals/by-token/${token}/clauses/${clauseId}/suggest-moves`
        : null;

  const fetchMoves = async (force = false) => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(force ? `${url}?force=1` : url, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Не удалось получить предложения");
        return;
      }
      const data = (await res.json()) as Moves;
      setMoves(data.moves);
    } catch {
      setError("Не удалось получить предложения");
    } finally {
      setLoading(false);
    }
  };

  if (!moves && !loading) {
    return (
      <div className="mt-4 pt-4 border-t border-rule">
        <button
          type="button"
          onClick={() => void fetchMoves()}
          className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-primary font-semibold hover:underline underline-offset-4"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          AI поможет договориться →
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mt-4 pt-4 border-t border-rule">
        <p className="text-[10px] uppercase tracking-[0.22em] text-primary mb-3 inline-flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          AI готовит варианты
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="border border-rule rounded-md p-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-3 w-full" />
              <Skeleton className="mt-1.5 h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !moves) {
    return (
      <div className="mt-4 pt-4 border-t border-rule">
        <p className="text-sm text-danger mb-2">{error ?? "Нет данных"}</p>
        <button
          type="button"
          onClick={() => void fetchMoves(true)}
          className="text-xs font-semibold text-primary hover:underline"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-rule">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.22em] text-primary font-semibold inline-flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          AI рекомендует
        </p>
        <button
          type="button"
          onClick={() => void fetchMoves(true)}
          className="text-[10px] uppercase tracking-[0.18em] text-ink-quiet hover:text-foreground inline-flex items-center gap-1"
          aria-label="Сгенерировать заново"
        >
          <RefreshCw className="h-3 w-3" aria-hidden />
          Обновить
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {moves.map((m) => (
          <MoveCard
            key={m.id}
            move={m}
            onApply={() => {
              if (m.id === "A") onApplyAccept();
              else if (m.id === "B" && m.proposedText)
                onApplyCompromise(m.proposedText);
              else if (m.id === "C") onApplyStand(m.body);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function MoveCard({ move, onApply }: { move: Move; onApply: () => void }) {
  return (
    <article className="border border-rule rounded-md p-3 flex flex-col">
      <h4 className="font-serif text-sm font-semibold text-foreground">
        {move.title}
      </h4>
      <p className="mt-1.5 text-[12px] leading-[1.5] text-ink-quiet flex-1">
        {move.body}
      </p>
      {move.proposedText && (
        <div className="mt-2.5 border border-rule bg-surface/40 rounded-md p-2 font-mono text-[11px] leading-[1.45] text-foreground/80 break-words">
          {move.proposedText}
        </div>
      )}
      <button
        type="button"
        onClick={onApply}
        className="mt-3 self-start text-xs font-semibold text-primary hover:underline underline-offset-4"
      >
        Применить →
      </button>
    </article>
  );
}
