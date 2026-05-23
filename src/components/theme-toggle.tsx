"use client";

// Two-state theme toggle: light ↔ dark. We dropped the "system" state —
// real users want explicit control, the OS-follow behaviour is still the
// initial default before the user touches the toggle (see boot script in
// layout.tsx + ThemeProvider initial sync).

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useT } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, setTheme } = useTheme();
  const t = useT();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch — server can't know the user's choice.
  // The one-shot "mounted" flag is the canonical pattern for this; the
  // setState-in-effect lint rule is a false positive here.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg text-muted",
          className
        )}
      >
        <Sun className="h-4 w-4 opacity-0" />
      </button>
    );
  }

  const isDark = resolved === "dark";
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? t("theme.light") : t("theme.dark");

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={`${t("theme.toggle")}: ${label}`}
      title={label}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground",
        className
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
