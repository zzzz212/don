"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  ScrollText,
  BookOpen,
  Wand2,
  Undo2,
  AlertTriangle,
} from "lucide-react";
import { RiskBadge, type RiskLevel } from "./risk-badge";

export interface RiskItem {
  clauseNumber: string;
  clauseTitle: string;
  level: RiskLevel;
  description: string;
  /** Concrete fallout for the client if the clause is signed as-is.
   *  Optional — analyses produced before this field existed omit it. */
  consequence?: string;
  legalReference: string;
  originalText: string;
  recommendedText: string;
  recommendation: string;
}

interface AnalysisCardProps {
  risk: RiskItem;
  index: number;
  /** Has the user applied this risk's recommended fix to the working
   *  copy of the contract? When true, the card switches to "applied"
   *  mode (green pill, undo button instead of apply). */
  applied?: boolean;
  /** Click handler for the "Apply fix" / "Undo" button. When undefined,
   *  the apply UI is hidden — same card is used in print/PDF where
   *  inline editing makes no sense. */
  onApply?: () => void;
  /** True when the original text genuinely appears in the working copy
   *  of the contract — without it, applying would be a no-op. The
   *  parent computes this once per render. */
  applicable?: boolean;
}

export function AnalysisCard({
  risk,
  index,
  applied,
  onApply,
  applicable,
}: AnalysisCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(risk.recommendedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const showApply = onApply && risk.originalText && risk.originalText !== "—";

  return (
    <div
      className={`animate-slide-up rounded-xl border bg-card p-5 transition-shadow hover:shadow-md ${
        applied ? "border-success/40 ring-1 ring-success/20" : "border-border"
      }`}
      style={{ animationDelay: `${index * 0.1}s`, opacity: 0 }}
    >
      {/* Header: badge + clause number + legal reference */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <RiskBadge level={risk.level} />
        <span className="text-xs font-semibold text-muted">
          {risk.clauseNumber}
        </span>
        <span className="inline-flex items-center gap-1 rounded-md bg-primary-light px-2 py-0.5 text-xs font-medium text-primary-dark">
          <BookOpen className="h-3 w-3" aria-hidden="true" />
          {risk.legalReference}
        </span>
        {applied && (
          <span className="inline-flex items-center gap-1 rounded-md bg-success-light px-2 py-0.5 text-xs font-semibold text-success">
            <Check className="h-3 w-3" aria-hidden="true" />
            Правка применена
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="mb-2 font-semibold text-foreground">{risk.clauseTitle}</h3>

      {/* Description */}
      <p className="mb-3 text-sm leading-relaxed text-muted">
        {risk.description}
      </p>

      {/* Consequence — what the client concretely stands to lose */}
      {risk.consequence && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/20 bg-warning-light/40 p-3">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-warning"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-warning">Чем это грозит</p>
            <p className="mt-0.5 text-sm leading-relaxed text-foreground/80">
              {risk.consequence}
            </p>
          </div>
        </div>
      )}

      {/* Original text */}
      {risk.originalText && risk.originalText !== "—" && (
        <div className="mb-3 rounded-lg border border-danger/20 bg-danger-light/50 p-3">
          <div className="mb-1 flex items-center gap-1.5">
            <ScrollText className="h-3.5 w-3.5 text-danger" aria-hidden="true" />
            <p className="text-xs font-semibold text-danger">
              Что написано сейчас
            </p>
          </div>
          <p className="text-sm leading-relaxed text-danger/80 italic">
            «{risk.originalText}»
          </p>
        </div>
      )}

      {/* Recommended replacement text */}
      {risk.recommendedText && risk.recommendedText !== "—" && (
        <div className="mb-3 rounded-lg border border-success/20 bg-success-light/50 p-3">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-success">
              Готовая формулировка для замены
            </p>
            <div className="flex flex-wrap items-center gap-1.5 print:hidden">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-card px-2 py-1 text-xs font-medium text-success transition-colors hover:bg-success-light"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3" aria-hidden="true" />
                    Скопировано
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" aria-hidden="true" />
                    Скопировать
                  </>
                )}
              </button>
              {showApply && (
                <button
                  onClick={onApply}
                  disabled={!applied && !applicable}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    applied
                      ? "border border-success/30 bg-card text-success hover:bg-success-light"
                      : "bg-success text-white hover:bg-success/90"
                  }`}
                  title={
                    applied
                      ? "Откатить правку в рабочей копии"
                      : applicable
                        ? "Заменить «Что написано сейчас» на эту формулировку в рабочей копии договора"
                        : "Цитата не найдена в тексте договора — применить автоматически нельзя"
                  }
                >
                  {applied ? (
                    <>
                      <Undo2 className="h-3 w-3" aria-hidden="true" />
                      Откатить
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-3 w-3" aria-hidden="true" />
                      Применить
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
          <p className="text-sm leading-relaxed text-success/90">
            {risk.recommendedText}
          </p>
        </div>
      )}

      {/* Action recommendation */}
      <div className="rounded-lg bg-primary-light/50 p-3">
        <p className="text-xs font-semibold text-primary-dark">
          Что делать
        </p>
        <p className="mt-0.5 text-sm leading-relaxed text-primary-dark/80">
          {risk.recommendation}
        </p>
      </div>
    </div>
  );
}
