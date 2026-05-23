"use client";

// Reusable empty-state shell: bespoke inline SVG illustration on top, a
// short title, optional description, and one or more CTAs.
//
// The illustration set shares a hand-drawn editorial vocabulary with
// `<DealRoomIllustration>`: hairline 1-1.4px strokes, tilted paper
// sheets, italic Georgia captions, terracotta used only on a single
// accent element per scene. Theme-aware via currentColor + CSS vars.

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
      <div className="mx-auto mb-7 flex h-32 w-44 items-center justify-center text-foreground">
        {illustration}
      </div>
      <h3 className="font-serif text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-quiet">
          {description}
        </p>
      )}
      {actions && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {actions}
        </div>
      )}
    </motion.div>
  );
}

// ── Shared editorial drop-shadow filter --------------------------------
// One filter defined once and re-used in every illustration so the paper
// sheets all sit on the canvas the same way.
function PaperShadow({ id }: { id: string }) {
  return (
    <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" />
      <feOffset dy="1.5" result="off" />
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.18" />
      </feComponentTransfer>
      <feMerge>
        <feMergeNode />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
}

// ── Page body — short stack of hairline rules, the only thing that
// changes between sheets is line length so each illustration reads
// distinctly without diverging the vocabulary.
function SheetBody({
  lines,
}: {
  lines: number[]; // line widths in SVG units
}) {
  return (
    <g>
      {lines.map((w, i) => (
        <line
          key={i}
          x1="12"
          y1={20 + i * 12}
          x2={12 + w}
          y2={20 + i * 12}
          stroke="currentColor"
          strokeOpacity={i === 0 ? 0.32 : 0.18}
          strokeWidth={i === 0 ? 1.2 : 1}
        />
      ))}
    </g>
  );
}

// ── Italic caption — Georgia serif, drop-cap style at the bottom of
// each sheet. Reads as a credit line.
function SheetCaption({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <text
      x={x}
      y={y}
      fontSize="6"
      fill="currentColor"
      fillOpacity="0.4"
      fontFamily="Georgia, serif"
      fontStyle="italic"
    >
      {text}
    </text>
  );
}

// ── 1. Documents empty — a stack of contracts on a desk -----------------
export function DocsEmptyIllustration() {
  return (
    <svg
      viewBox="0 0 240 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden="true"
      className="h-full w-full"
    >
      <defs>
        <PaperShadow id="docs-shadow" />
      </defs>
      {/* Back sheet — paper-pale */}
      <g transform="translate(60 30) rotate(-3)" filter="url(#docs-shadow)">
        <rect
          x="0"
          y="0"
          width="80"
          height="108"
          rx="2"
          fill="var(--card)"
          stroke="currentColor"
          strokeOpacity="0.16"
        />
        <SheetBody lines={[44, 60, 52, 60, 36]} />
      </g>
      {/* Middle sheet */}
      <g transform="translate(80 22) rotate(2)" filter="url(#docs-shadow)">
        <rect
          x="0"
          y="0"
          width="80"
          height="108"
          rx="2"
          fill="var(--card)"
          stroke="currentColor"
          strokeOpacity="0.16"
        />
        <SheetBody lines={[50, 62, 56, 62, 40, 56]} />
      </g>
      {/* Front sheet — fully drawn, terracotta seal */}
      <g transform="translate(100 14) rotate(-1)" filter="url(#docs-shadow)">
        <rect
          x="0"
          y="0"
          width="80"
          height="108"
          rx="2"
          fill="var(--card)"
          stroke="currentColor"
          strokeOpacity="0.2"
        />
        <SheetBody lines={[54, 64, 58, 64, 42, 60, 38]} />
        <line
          x1="12"
          y1="88"
          x2="44"
          y2="88"
          stroke="currentColor"
          strokeOpacity="0.42"
          strokeWidth="1.4"
        />
        <SheetCaption x={12} y={100} text="ваш договор" />
        {/* Seal — single terracotta dot, the only accent. */}
        <circle cx="62" cy="92" r="4" fill="var(--primary)" />
        <circle
          cx="62"
          cy="92"
          r="7"
          fill="none"
          stroke="var(--primary)"
          strokeOpacity="0.3"
          strokeWidth="1"
        />
      </g>
    </svg>
  );
}

// ── 2. Chat empty — a single page with a quill stroke -------------------
export function ChatEmptyIllustration() {
  return (
    <svg
      viewBox="0 0 240 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden="true"
      className="h-full w-full"
    >
      <defs>
        <PaperShadow id="chat-shadow" />
      </defs>
      <g transform="translate(72 22)" filter="url(#chat-shadow)">
        <rect
          x="0"
          y="0"
          width="96"
          height="116"
          rx="2"
          fill="var(--card)"
          stroke="currentColor"
          strokeOpacity="0.18"
        />
        <SheetBody lines={[60, 72, 66, 72, 50, 68, 44]} />
        {/* The cursor — a single italic line being written. */}
        <path
          d="M 22 96 Q 38 84 56 94 T 92 92"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="92" cy="92" r="3" fill="var(--primary)" />
        <SheetCaption x={12} y={108} text="вопрос юристу" />
      </g>
    </svg>
  );
}

// ── 3. Counterparty empty — a stamped envelope on a sheet -----------
export function CounterpartyEmptyIllustration() {
  return (
    <svg
      viewBox="0 0 240 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden="true"
      className="h-full w-full"
    >
      <defs>
        <PaperShadow id="counterparty-shadow" />
      </defs>
      {/* Document underneath */}
      <g transform="translate(58 30) rotate(-3)" filter="url(#counterparty-shadow)">
        <rect
          x="0"
          y="0"
          width="84"
          height="110"
          rx="2"
          fill="var(--card)"
          stroke="currentColor"
          strokeOpacity="0.16"
        />
        <SheetBody lines={[52, 64, 58, 64, 42]} />
      </g>
      {/* Envelope — sits on top, the magnifier is gone in favour of a
          clean envelope shape with a single terracotta wax-seal dot. */}
      <g transform="translate(100 56)" filter="url(#counterparty-shadow)">
        <rect
          x="0"
          y="0"
          width="92"
          height="64"
          rx="2"
          fill="var(--card)"
          stroke="currentColor"
          strokeOpacity="0.32"
          strokeWidth="1.2"
        />
        <path
          d="M 0 4 L 46 38 L 92 4"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.32"
          strokeWidth="1.2"
        />
        {/* Wax seal */}
        <circle cx="46" cy="38" r="6" fill="var(--primary)" />
        <circle
          cx="46"
          cy="38"
          r="10"
          fill="none"
          stroke="var(--primary)"
          strokeOpacity="0.3"
          strokeWidth="1"
        />
      </g>
    </svg>
  );
}

// ── 4. Search empty — a magnifier resting on a folded note ----------
export function SearchEmptyIllustration() {
  return (
    <svg
      viewBox="0 0 240 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden="true"
      className="h-full w-full"
    >
      <defs>
        <PaperShadow id="search-shadow" />
      </defs>
      {/* The note */}
      <g transform="translate(60 32) rotate(-4)" filter="url(#search-shadow)">
        <rect
          x="0"
          y="0"
          width="84"
          height="100"
          rx="2"
          fill="var(--card)"
          stroke="currentColor"
          strokeOpacity="0.18"
        />
        <SheetBody lines={[44, 58, 50, 58, 36]} />
        <SheetCaption x={12} y={94} text="ничего не найдено" />
      </g>
      {/* Magnifier — terracotta ring, hairline handle */}
      <g transform="translate(118 64)">
        <circle
          cx="32"
          cy="32"
          r="22"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.2"
        />
        <circle
          cx="32"
          cy="32"
          r="16"
          fill="var(--card)"
          stroke="currentColor"
          strokeOpacity="0.18"
        />
        <line
          x1="48"
          y1="48"
          x2="64"
          y2="64"
          stroke="var(--primary)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
