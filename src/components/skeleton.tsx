// Lightweight skeleton primitives. Pulse animation is a Tailwind class
// (animate-pulse) — no extra CSS needed. Use these directly inline or
// compose into feature-specific shells like DocumentRowSkeleton below.

import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

export function Skeleton({ className }: Props) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded bg-surface",
        className
      )}
    />
  );
}

/** Skeleton for a row in the dashboard document list. */
export function DocumentRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-6 py-4">
      <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-3 w-2/5" />
      </div>
      <Skeleton className="h-6 w-16" />
      <Skeleton className="h-6 w-12" />
    </div>
  );
}

/** Skeleton for the /billing current-plan card. */
export function BillingCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <Skeleton className="mb-2 h-3 w-24" />
      <Skeleton className="mb-4 h-6 w-1/3" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-6 w-20 rounded-lg" />
      </div>
    </div>
  );
}
