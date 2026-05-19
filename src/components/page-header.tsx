import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Shared page-header band: title + optional description on the left,
// optional action row on the right, sitting on a `bg-card` strip with
// a hairline border below. Every <AppShell>-wrapped page leads with
// this so the platform's content area always opens with the same
// structured beat.

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Optional eyebrow / breadcrumb-style label above the title. */
  eyebrow?: string;
  /** Right-side action row — typically <Button>s or <Link>s. */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-border bg-card px-6 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-8",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
