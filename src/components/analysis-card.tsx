"use client";

import { useState } from "react";
import { Check, Copy, ScrollText, BookOpen } from "lucide-react";
import { RiskBadge, type RiskLevel } from "./risk-badge";

export interface RiskItem {
  clauseNumber: string;
  clauseTitle: string;
  level: RiskLevel;
  description: string;
  legalReference: string;
  originalText: string;
  recommendedText: string;
  recommendation: string;
}

interface AnalysisCardProps {
  risk: RiskItem;
  index: number;
}

export function AnalysisCard({ risk, index }: AnalysisCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(risk.recommendedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="animate-slide-up rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
      style={{ animationDelay: `${index * 0.1}s`, opacity: 0 }}
    >
      {/* Header: badge + clause number + legal reference */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <RiskBadge level={risk.level} />
        <span className="text-xs font-semibold text-muted">
          {risk.clauseNumber}
        </span>
        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
          <BookOpen className="h-3 w-3" />
          {risk.legalReference}
        </span>
      </div>

      {/* Title */}
      <h3 className="mb-2 font-semibold text-foreground">{risk.clauseTitle}</h3>

      {/* Description */}
      <p className="mb-4 text-sm leading-relaxed text-muted">
        {risk.description}
      </p>

      {/* Original text */}
      {risk.originalText && risk.originalText !== "—" && (
        <div className="mb-3 rounded-lg border border-red-100 bg-red-50/50 p-3">
          <div className="mb-1 flex items-center gap-1.5">
            <ScrollText className="h-3.5 w-3.5 text-red-600" />
            <p className="text-xs font-semibold text-red-800">
              Что написано сейчас
            </p>
          </div>
          <p className="text-sm leading-relaxed text-red-900/80 italic">
            «{risk.originalText}»
          </p>
        </div>
      )}

      {/* Recommended replacement text */}
      {risk.recommendedText && risk.recommendedText !== "—" && (
        <div className="mb-3 rounded-lg border border-green-100 bg-green-50/50 p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-semibold text-green-800">
              Готовая формулировка для замены
            </p>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-white px-2 py-1 text-xs font-medium text-green-700 transition-colors hover:bg-green-100 print:hidden"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" />
                  Скопировано
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Скопировать
                </>
              )}
            </button>
          </div>
          <p className="text-sm leading-relaxed text-green-900/90">
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
