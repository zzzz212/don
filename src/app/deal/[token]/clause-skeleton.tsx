// Editorial loading skeleton for a clause card. Structure mirrors
// ClauseCard so the page doesn't reflow when real data lands. Uses the
// shared shimmer-sweep primitive (src/components/skeleton.tsx) — that
// keyframe is already defined in globals.css and respects
// prefers-reduced-motion.

import { Skeleton } from "@/components/skeleton";

export function ClauseSkeleton() {
  return (
    <article className="border-l-2 border-l-rule pl-5 sm:pl-7">
      <div className="grid gap-x-8 gap-y-5 md:grid-cols-[1.4fr_1fr]">
        {/* Document column */}
        <div>
          <div className="flex items-baseline gap-3">
            <Skeleton className="h-5 w-8" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
        {/* Counter-AI column */}
        <aside className="space-y-4 md:border-l md:border-rule md:pl-7">
          <div>
            <Skeleton className="h-2.5 w-24" />
            <div className="mt-2 space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </div>
          </div>
          <div>
            <Skeleton className="h-2.5 w-28" />
            <div className="mt-2 space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        </aside>
      </div>
    </article>
  );
}
