"use client";

import { Check } from "lucide-react";
import type { ClauseView } from "./clause-card";

// Sticky bottom bar — shows live progress as a slim measured-rule.
// On AGREED-everything it flips to a triumphant single-line state.
// Editorial style: hairline top border, generous tracking on labels,
// the progress shown as a actual thin rule fill (not a chunky bar).

export function StatusBar({
  clauses,
  status,
}: {
  clauses: ClauseView[];
  status: "ACTIVE" | "AGREED";
}) {
  const total = Math.max(1, clauses.length);
  const counts = clauses.reduce(
    (acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const agreed = counts.AGREED ?? 0;
  const disputed = counts.DISPUTED ?? 0;
  const pending = total - agreed - disputed;

  const agreedPct = (agreed / total) * 100;
  const disputedPct = (disputed / total) * 100;

  return (
    <div className="sticky bottom-0 z-20 border-t border-rule bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      {/* Hairline progress rule, hugging the top border. The bar uses
          two stacked spans so AGREED + DISPUTED can both show their
          share when a deal is partially contested. */}
      <div className="h-[2px] w-full bg-rule/40">
        <div className="flex h-full">
          <div
            className="h-full bg-success transition-[width] duration-500"
            style={{ width: `${agreedPct}%` }}
          />
          <div
            className="h-full bg-primary/80 transition-[width] duration-500"
            style={{ width: `${disputedPct}%` }}
          />
        </div>
      </div>

      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3 sm:px-10">
        {status === "AGREED" ? (
          <div className="flex items-center gap-2 text-success">
            <Check className="h-4 w-4" aria-hidden="true" />
            <span className="font-serif text-sm font-semibold tracking-tight">
              Договор согласован полностью
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[13px]">
            <span className="font-serif text-base font-semibold tabular-nums text-foreground">
              {agreed}
              <span className="text-ink-quiet font-sans font-normal">
                {" / "}
                {total}
              </span>
            </span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-ink-quiet">
              согласовано
            </span>
            {disputed > 0 && (
              <>
                <span aria-hidden className="text-rule">·</span>
                <span className="text-primary font-medium">
                  {disputed} спорных
                </span>
              </>
            )}
            {pending > 0 && (
              <>
                <span aria-hidden className="text-rule">·</span>
                <span className="text-ink-quiet">{pending} не тронуто</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
