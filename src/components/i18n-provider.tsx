"use client";

// Locale provider. Pairs with the inline no-FOIT script in layout.tsx
// which sets <html lang> early so server-rendered text already shows in
// the right language attribute (matters for screen readers / hyphenation).

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LOCALE,
  type Locale,
  SUPPORTED_LOCALES,
  translate,
} from "@/lib/i18n/messages";

const STORAGE_KEY = "yakso:locale";

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<Ctx | null>(null);

function readStored(): Locale | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && (SUPPORTED_LOCALES as string[]).includes(v)) return v as Locale;
  } catch {
    // localStorage may throw in private mode — fall through.
  }
  return null;
}

function detectFromBrowser(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const raw of langs) {
    const tag = raw?.toLowerCase().split("-")[0];
    if (tag && (SUPPORTED_LOCALES as string[]).includes(tag)) return tag as Locale;
  }
  return DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // Initial sync after mount — server snapshot is always default RU,
  // we hydrate the user's preference client-side. Mismatches are fine:
  // the dictionary fallback ensures both copies make sense.
  useEffect(() => {
    const stored = readStored();
    const next = stored ?? detectFromBrowser();
    if (next !== locale) {
      setLocaleState(next);
      document.documentElement.lang = next;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    document.documentElement.lang = l;
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignore — non-essential persistence
    }
  }, []);

  const t = useCallback((key: string) => translate(locale, key), [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // No-op fallback for components rendered outside the provider
    // (typically tests). Returns the key as the translation so failures
    // are visible rather than silent.
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: (k) => translate(DEFAULT_LOCALE, k),
    };
  }
  return ctx;
}

export function useT() {
  return useI18n().t;
}
