import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Small status chip. Square-ish corners (rounded-md, not a full pill) —
// pills read playful; a chip reads "деловой". Tones map to the palette.

export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

const TONE: Record<BadgeTone, string> = {
  neutral: "border-border bg-surface text-muted",
  info: "border-primary/20 bg-primary-light text-primary-dark",
  success: "border-success/25 bg-success-light text-success",
  warning: "border-warning/25 bg-warning-light text-warning",
  danger: "border-danger/25 bg-danger-light text-danger",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold",
        TONE[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
