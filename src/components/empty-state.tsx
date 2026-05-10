"use client";

// Reusable empty-state shell: bespoke inline SVG illustration on top, a
// short title, optional description, and one or more CTAs. Replaces the
// generic Lucide-icon-in-a-rounded-square empty-states scattered across
// the app — those are functional but read as cheap.
//
// Illustrations live in the same file (small, lazy by default since they
// only mount on empty pages) and are theme-aware via currentColor +
// var(--primary).

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  illustration: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function EmptyState({
  illustration,
  title,
  description,
  actions,
  className,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn("px-6 py-16 text-center", className)}
    >
      <div className="mx-auto mb-6 flex h-32 w-32 items-center justify-center text-primary">
        {illustration}
      </div>
      <h3 className="text-lg font-bold tracking-tight text-foreground">
        {title}
      </h3>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          {description}
        </p>
      )}
      {actions && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {actions}
        </div>
      )}
    </motion.div>
  );
}

// ---- Inline SVG illustrations ----------------------------------------
// Each is 128×128, stroke-based to inherit theme tokens. We use
// `text-primary` on the wrapper (above) so currentColor lights up the
// branded element and the rest defaults to the foreground muted tone.

export function DocsEmptyIllustration() {
  return (
    <svg
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden="true"
      className="h-full w-full"
    >
      {/* Back paper */}
      <rect
        x="34"
        y="22"
        width="56"
        height="74"
        rx="6"
        className="fill-surface stroke-border-strong"
        strokeWidth="1.5"
      />
      {/* Front paper (slight rotation), branded */}
      <g transform="rotate(-6 64 70)">
        <rect
          x="40"
          y="34"
          width="56"
          height="74"
          rx="6"
          className="fill-card stroke-current"
          strokeWidth="1.6"
        />
        <line x1="50" y1="50" x2="86" y2="50" className="stroke-current" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
        <line x1="50" y1="60" x2="78" y2="60" className="stroke-current" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
        <line x1="50" y1="70" x2="84" y2="70" className="stroke-current" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
        <line x1="50" y1="80" x2="72" y2="80" className="stroke-current" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
        {/* Corner check */}
        <circle cx="84" cy="46" r="6" className="fill-current" />
        <path d="M81 46 L83.5 48.5 L88 44" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
    </svg>
  );
}

export function ChatEmptyIllustration() {
  return (
    <svg
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden="true"
      className="h-full w-full"
    >
      <path
        d="M28 36 a8 8 0 0 1 8 -8 h44 a8 8 0 0 1 8 8 v22 a8 8 0 0 1 -8 8 H50 l-12 12 v-12 h-2 a8 8 0 0 1 -8 -8 z"
        className="fill-surface stroke-border-strong"
        strokeWidth="1.5"
      />
      <path
        d="M52 60 a8 8 0 0 1 8 -8 h36 a8 8 0 0 1 8 8 v22 a8 8 0 0 1 -8 8 H80 l12 12 v-12 h2 a8 8 0 0 0 8 -8 z"
        className="fill-card stroke-current"
        strokeWidth="1.6"
        transform="translate(-4 4)"
      />
      <circle cx="64" cy="76" r="2.5" className="fill-current" />
      <circle cx="74" cy="76" r="2.5" className="fill-current" />
      <circle cx="84" cy="76" r="2.5" className="fill-current" />
    </svg>
  );
}

export function CounterpartyEmptyIllustration() {
  return (
    <svg
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden="true"
      className="h-full w-full"
    >
      {/* Building */}
      <rect
        x="34"
        y="40"
        width="48"
        height="60"
        rx="2"
        className="fill-surface stroke-border-strong"
        strokeWidth="1.5"
      />
      {/* Windows */}
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={40 + col * 12}
            y={48 + row * 14}
            width="6"
            height="8"
            rx="1"
            className="fill-card stroke-current"
            strokeWidth="1.2"
            opacity={0.55}
          />
        ))
      )}
      {/* Magnifier */}
      <circle
        cx="86"
        cy="78"
        r="14"
        className="fill-card stroke-current"
        strokeWidth="2"
      />
      <line
        x1="96"
        y1="88"
        x2="106"
        y2="98"
        className="stroke-current"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SearchEmptyIllustration() {
  return (
    <svg
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden="true"
      className="h-full w-full"
    >
      <circle
        cx="56"
        cy="56"
        r="26"
        className="fill-surface stroke-border-strong"
        strokeWidth="1.5"
      />
      <circle
        cx="56"
        cy="56"
        r="20"
        className="fill-card stroke-current"
        strokeWidth="1.8"
        opacity={0.55}
      />
      <line
        x1="78"
        y1="78"
        x2="98"
        y2="98"
        className="stroke-current"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* Question mark inside */}
      <path
        d="M50 52 a6 6 0 0 1 12 0 c0 4 -6 4 -6 8"
        className="stroke-current"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="56" cy="66" r="1.6" className="fill-current" />
    </svg>
  );
}
