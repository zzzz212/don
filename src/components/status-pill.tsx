"use client";

// Status pill — a small label with an optional pulsing dot for "live"
// states (анализ идёт, ожидаем оплаты, новая версия в работе).
//
// Tones: success / warning / danger / neutral / primary. The pulsing
// dot animates only when `live` is true and the user hasn't asked for
// reduced motion (handled globally via the @media block in globals.css).

import { cn } from "@/lib/utils";

export type StatusTone =
  | "success"
  | "warning"
  | "danger"
  | "neutral"
  | "primary";

const TONE_CLASSES: Record<StatusTone, { bg: string; text: string; dot: string }> = {
  success: {
    bg: "bg-success-light",
    text: "text-success",
    dot: "bg-success",
  },
  warning: {
    bg: "bg-warning-light",
    text: "text-warning",
    dot: "bg-warning",
  },
  danger: {
    bg: "bg-danger-light",
    text: "text-danger",
    dot: "bg-danger",
  },
  neutral: {
    bg: "bg-surface",
    text: "text-muted",
    dot: "bg-muted",
  },
  primary: {
    bg: "bg-primary-light",
    text: "text-primary-dark",
    dot: "bg-primary",
  },
};

export function StatusPill({
  tone = "neutral",
  live = false,
  children,
  className,
}: {
  tone?: StatusTone;
  /** When true, the leading dot pulses to signal an in-flight state. */
  live?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const c = TONE_CLASSES[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold",
        c.bg,
        c.text,
        className
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        {live && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              c.dot
            )}
          />
        )}
        <span
          className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", c.dot)}
        />
      </span>
      {children}
    </span>
  );
}
