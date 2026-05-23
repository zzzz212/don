"use client";

import type { ClauseView } from "./clause-card";

// Sticky footer that shows a live count of agreed / disputed / pending
// clauses plus a "fully agreed" banner when all clauses are settled.

export function StatusBar({
  clauses,
  status,
}: {
  clauses: ClauseView[];
  status: "ACTIVE" | "AGREED";
}) {
  const counts = clauses.reduce(
    (acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const total = clauses.length;
  const agreed = counts.AGREED ?? 0;
  const disputed = counts.DISPUTED ?? 0;
  const pending = total - agreed - disputed;

  return (
    <div className="sticky bottom-0 border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-3 text-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="font-medium text-foreground">
            {agreed}/{total} согласовано
          </span>
          {disputed > 0 && (
            <span className="text-danger">{disputed} спорных</span>
          )}
          {pending > 0 && (
            <span className="text-muted">{pending} не тронуто</span>
          )}
        </div>
        {status === "AGREED" && (
          <span className="text-success font-medium">✓ Договор согласован</span>
        )}
      </div>
    </div>
  );
}
