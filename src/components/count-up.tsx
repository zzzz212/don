"use client";

// requestAnimationFrame-based number tween. Used in dashboards where
// "0 → 207" reading better as a quick count-up than a raw number that
// just appears. Cheap (one rAF per frame, runs ~30 frames at most),
// theme-agnostic, accessibility-respecting (skips animation when the
// user prefers reduced motion).

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 600;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function CountUp({
  value,
  format = (v: number) => v.toLocaleString("ru-RU"),
  className,
}: {
  value: number;
  format?: (v: number) => string;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const eased = easeOutCubic(t);
      const current = Math.round(from + (to - from) * eased);
      setDisplay(current);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span className={className} aria-live="polite">
      {format(display)}
    </span>
  );
}
