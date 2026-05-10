"use client";

// Three-state theme toggle: light / dark / system. We render a single
// button cycling through states (sun → moon → monitor) — simpler UX than
// a dropdown for a setting that 99% of users never touch after first try.

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useT } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

const ORDER = ["light", "dark", "system"] as const;

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const t = useT();
  const [mounted, setMounted] = useState(false);

  // Only render once mounted, otherwise SSR snapshot mismatches the
  // hydrated state (server can't know user's choice).
  useEffect(() => setMounted(true), []);

  const cycle = () => {
    const i = ORDER.indexOf(theme);
    const next = ORDER[(i + 1) % ORDER.length];
    setTheme(next);
  };

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

  const meta = {
    light: { icon: Sun, label: t("theme.light") },
    dark: { icon: Moon, label: t("theme.dark") },
    system: { icon: Monitor, label: t("theme.system") },
  } as const;
  const { icon: Icon, label } = meta[theme];

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`${label} — ${t("theme.toggle")}`}
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
