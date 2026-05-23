"use client";

// Breadcrumb trail. Used on detail pages where the user might be three
// or four levels deep (audit log, version compare, admin user detail)
// and needs an obvious "back to the list" affordance.
//
// Items render as <Link> with chevron separators. The last item is the
// current page — rendered as plain text with aria-current="page" so it
// gets the screen-reader treatment of "current location".

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumbs({
  items,
  homeHref = "/dashboard",
  className,
}: {
  items: BreadcrumbItem[];
  /** Where the leading home icon links to. Default /dashboard. */
  homeHref?: string;
  className?: string;
}) {
  return (
    <nav
      aria-label="Хлебные крошки"
      className={cn(
        "mb-4 flex items-center gap-1 text-sm text-muted",
        className
      )}
    >
      <Link
        href={homeHref}
        aria-label="Дашборд"
        className="rounded p-1 transition-colors hover:bg-surface hover:text-foreground"
      >
        <Home className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="flex items-center gap-1">
            <ChevronRight
              className="h-3.5 w-3.5 shrink-0 text-muted/60"
              aria-hidden="true"
            />
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="truncate rounded px-1.5 py-0.5 transition-colors hover:bg-surface hover:text-foreground"
              >
                {item.label}
              </Link>
            ) : (
              <span
                aria-current={isLast ? "page" : undefined}
                className={cn(
                  "truncate px-1.5 py-0.5",
                  isLast ? "font-medium text-foreground" : ""
                )}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
