"use client";

import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { LOCALE_SHORT, type Locale, SUPPORTED_LOCALES } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

// Two-locale toggle (RU ↔ EN). Renders the short label of the OTHER
// locale — that's the one the user is about to switch to, which is
// clearer than showing the active one.

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const next: Locale =
    SUPPORTED_LOCALES[(SUPPORTED_LOCALES.indexOf(locale) + 1) % SUPPORTED_LOCALES.length];

  if (!mounted) {
    // Avoid hydration mismatch — server can't know the user's locale.
    return (
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        className={cn(
          "flex h-9 min-w-9 items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold text-muted",
          className
        )}
      >
        <Globe className="h-4 w-4 opacity-0" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      aria-label={`${t("language.toggle")}: ${LOCALE_SHORT[next]}`}
      title={t("language.toggle")}
      className={cn(
        "flex h-9 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-muted transition-colors hover:bg-surface hover:text-foreground",
        className
      )}
    >
      <Globe className="h-4 w-4" aria-hidden="true" />
      {LOCALE_SHORT[next]}
    </button>
  );
}
