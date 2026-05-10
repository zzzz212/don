"use client";

// Theme provider with three states: light, dark, system. The active class
// (.dark on <html>) is set by an inline script in layout.tsx BEFORE
// React hydrates, so the visual theme never flashes — this provider only
// owns the React-side state and the toggle UI plumbing.

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "juriist:theme";

type Ctx = {
  theme: ThemeChoice;
  resolved: "light" | "dark";
  setTheme: (t: ThemeChoice) => void;
};

const ThemeContext = createContext<Ctx | null>(null);

function readSystemPreference(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readStored(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // localStorage may throw in private mode / SSR — fall through.
  }
  return "system";
}

function applyClass(resolved: "light" | "dark") {
  const root = document.documentElement;
  if (resolved === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  // Also update `color-scheme` so native UI (scrollbars, form widgets) matches.
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  // Initial sync with localStorage / system once the component mounts.
  useEffect(() => {
    const initial = readStored();
    setThemeState(initial);
    const sysNow = readSystemPreference();
    const next = initial === "system" ? sysNow : initial;
    setResolved(next);
    applyClass(next);
  }, []);

  // Listen to system changes — only flips when user is on "system".
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const next = e.matches ? "dark" : "light";
      setResolved(next);
      applyClass(next);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((t: ThemeChoice) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // ignore — non-essential persistence
    }
    const next = t === "system" ? readSystemPreference() : t;
    setResolved(next);
    applyClass(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Allow components to call useTheme outside the provider during SSR/test
    // by returning a noop — callers can detect and skip rendering toggle UI.
    return {
      theme: "system",
      resolved: "light",
      setTheme: () => {},
    };
  }
  return ctx;
}
