// Brand mark — an ink tile carrying the serif "Я", auto-inverting in
// dark mode (ink tile / paper letter ↔ paper tile / ink letter), with an
// optional "Яксо" wordmark. Single source of the in-app logo; the
// favicon / OG routes inline an equivalent mark for next/og (Satori
// can't import a React component cleanly).

import { cn } from "@/lib/utils";

export function Logo({
  size = 36,
  wordmark,
  className,
}: {
  /** Side length of the square mark, in px. */
  size?: number;
  /** When set, the wordmark text is rendered next to the mark. */
  wordmark?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.22),
          fontSize: Math.round(size * 0.56),
        }}
        className="inline-flex shrink-0 items-center justify-center bg-foreground font-serif font-semibold leading-none text-background"
      >
        Я
      </span>
      {wordmark ? (
        <span
          className="font-serif font-semibold tracking-tight text-foreground"
          style={{ fontSize: Math.round(size * 0.55) }}
        >
          {wordmark}
        </span>
      ) : null}
    </span>
  );
}
