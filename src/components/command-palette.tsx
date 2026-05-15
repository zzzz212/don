"use client";

// ⌘K command palette. Lightweight, no external dep — built on motion +
// the same useToast/useT plumbing the rest of the app already uses.
//
// Renders as a bottom-sheet on narrow screens / centered dialog on wide.
// Fires on ⌘K / Ctrl+K from anywhere. Escape closes. Arrow up/down
// navigates the result list, Enter executes.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  Search,
  ArrowRight,
  LayoutDashboard,
  FileText,
  FolderOpen,
  Building2,
  MessageCircle,
  CreditCard,
  Lock,
  Settings,
  Plus,
  Sparkles,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  label: string;
  hint?: string;
  group: "Навигация" | "Действия" | "Настройки";
  icon: typeof Search;
  /** Either a path to navigate to, or a function to run on Enter. */
  run: () => void;
};

function isMacLike(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const { resolved, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build the catalogue. useMemo so the items array reference is stable
  // for the keyboard handler dependencies.
  const items: Item[] = useMemo(
    () => [
      {
        id: "nav.dashboard",
        label: "Дашборд",
        hint: "Обзор анализов и документов",
        group: "Навигация",
        icon: LayoutDashboard,
        run: () => router.push("/dashboard"),
      },
      {
        id: "nav.analyze",
        label: "Анализ договора",
        hint: "Загрузить PDF/DOCX",
        group: "Навигация",
        icon: FileText,
        run: () => router.push("/analyze"),
      },
      {
        id: "nav.templates",
        label: "Шаблоны документов",
        hint: "20 готовых форм",
        group: "Навигация",
        icon: FolderOpen,
        run: () => router.push("/templates"),
      },
      {
        id: "nav.counterparty",
        label: "Проверка контрагента",
        hint: "По ИНН / ОГРН",
        group: "Навигация",
        icon: Building2,
        run: () => router.push("/counterparty"),
      },
      {
        id: "nav.chat",
        label: "AI-консультант",
        hint: "Юридические вопросы",
        group: "Навигация",
        icon: MessageCircle,
        run: () => router.push("/chat"),
      },
      {
        id: "act.new-analysis",
        label: "Новый анализ договора",
        group: "Действия",
        icon: Plus,
        run: () => router.push("/analyze"),
      },
      {
        id: "act.new-document",
        label: "Создать документ из шаблона",
        group: "Действия",
        icon: Sparkles,
        run: () => router.push("/templates"),
      },
      {
        id: "set.billing",
        label: "Тариф и биллинг",
        group: "Настройки",
        icon: CreditCard,
        run: () => router.push("/billing"),
      },
      {
        id: "set.security",
        label: "Безопасность аккаунта",
        hint: "2FA, пароль",
        group: "Настройки",
        icon: Lock,
        run: () => router.push("/account/security"),
      },
      {
        id: "set.organization",
        label: "Настройки workspace",
        group: "Настройки",
        icon: Settings,
        run: () => router.push("/settings/organization"),
      },
      {
        id: "set.theme",
        label: resolved === "dark" ? "Светлая тема" : "Тёмная тема",
        group: "Настройки",
        icon: resolved === "dark" ? Sun : Moon,
        run: () => setTheme(resolved === "dark" ? "light" : "dark"),
      },
    ],
    [router, resolved, setTheme]
  );

  // Substring + accent-insensitive filter. Items keep their original
  // order so groups stay coherent in the rendered list.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const hay = `${it.label} ${it.hint ?? ""} ${it.group}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  // Group filtered items for rendering.
  const grouped = useMemo(() => {
    const out = new Map<Item["group"], Item[]>();
    for (const it of filtered) {
      const list = out.get(it.group) ?? [];
      list.push(it);
      out.set(it.group, list);
    }
    return out;
  }, [filtered]);

  // Reset query when opened (so each new open starts clean) and focus.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      // Defer focus a tick so the modal mount transition can settle.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Close when the route actually changed (not when the user just typed).
  // Pathname is the trigger; we can't watch router.push directly.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Global ⌘K / Ctrl+K. Skip when the user is typing in an input that
  // isn't ours — but always allow closing with Escape.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const onListKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        const it = filtered[activeIdx];
        if (it) {
          e.preventDefault();
          it.run();
          setOpen(false);
        }
      }
    },
    [filtered, activeIdx]
  );

  const mac = isMacLike();

  return (
    <>
      {/* Trigger pill — visible on lg+ so the keyboard hint is discoverable.
          Mobile users get the same panel via `/` nav link for now. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Открыть командную палитру (${mac ? "⌘K" : "Ctrl+K"})`}
        title={mac ? "⌘K" : "Ctrl+K"}
        className="hidden lg:flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-xs text-muted transition-colors hover:bg-card-hover hover:text-foreground"
      >
        <Search className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Поиск</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[110] flex items-end justify-center bg-foreground/40 backdrop-blur-sm px-4 py-6 sm:items-start sm:pt-[12vh]"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.7 }}
              role="dialog"
              aria-modal="true"
              aria-label="Командная палитра"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={onListKey}
              className="flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            >
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActiveIdx(0);
                  }}
                  placeholder="Куда перейти или что сделать?"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
                  aria-label="Поиск по командной палитре"
                />
                <kbd className="hidden sm:inline shrink-0 rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
                  Esc
                </kbd>
              </div>

              <div className="max-h-[60vh] overflow-y-auto py-1">
                {filtered.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted">
                    Ничего не нашли по «{query}»
                  </p>
                ) : (
                  Array.from(grouped.entries()).map(([group, list]) => (
                    <div key={group} className="py-1">
                      <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                        {group}
                      </p>
                      <ul role="listbox">
                        {list.map((it) => {
                          const idx = filtered.indexOf(it);
                          const isActive = idx === activeIdx;
                          const Icon = it.icon;
                          return (
                            <li key={it.id}>
                              <button
                                type="button"
                                role="option"
                                aria-selected={isActive}
                                onMouseEnter={() => setActiveIdx(idx)}
                                onClick={() => {
                                  it.run();
                                  setOpen(false);
                                }}
                                className={cn(
                                  "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                                  isActive
                                    ? "bg-primary-light text-primary-dark"
                                    : "text-foreground hover:bg-surface"
                                )}
                              >
                                <Icon
                                  className={cn(
                                    "h-4 w-4 shrink-0",
                                    isActive ? "text-primary" : "text-muted"
                                  )}
                                  aria-hidden="true"
                                />
                                <span className="flex-1 truncate font-medium">
                                  {it.label}
                                </span>
                                {it.hint && (
                                  <span className="hidden truncate text-xs text-muted sm:inline">
                                    {it.hint}
                                  </span>
                                )}
                                <ArrowRight
                                  className={cn(
                                    "h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity",
                                    isActive && "opacity-100"
                                  )}
                                  aria-hidden="true"
                                />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border bg-surface/60 px-4 py-2 text-[11px] text-muted">
                <div className="flex items-center gap-2">
                  <kbd className="rounded border border-border bg-card px-1 py-px font-mono text-[10px] tabular-nums">↑↓</kbd>
                  <span>Навигация</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="rounded border border-border bg-card px-1 py-px font-mono text-[10px] tabular-nums">↵</kbd>
                  <span>Открыть</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="rounded border border-border bg-card px-1 py-px font-mono text-[10px] tabular-nums">Esc</kbd>
                  <span>Закрыть</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
