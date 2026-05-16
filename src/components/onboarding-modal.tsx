"use client";

// First-time-user welcome modal. Shows once per browser (localStorage
// flag); dismissed by clicking through to a feature or hitting Skip.
//
// Not a full guided tour with positioned tooltips — a single centered
// modal with three illustrated steps is dramatically less brittle (no
// ref-pinning to specific DOM nodes) and tests show users skim it about
// the same. Real tour with target highlights can come later if onboarding
// drop-off data demands it.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, FileSearch, FolderOpen, MessageCircle, X } from "lucide-react";

const STORAGE_KEY = "juriist:onboarding-seen";

const STEPS = [
  {
    icon: FileSearch,
    title: "Анализ договора за 30 секунд",
    description:
      "Загружаете PDF / DOCX — AI находит риски, оценивает каждый пункт и предлагает конкретные правки.",
    cta: "Загрузить договор",
    href: "/analyze",
  },
  {
    icon: FolderOpen,
    title: "Готовые юридические шаблоны",
    description:
      "20+ шаблонов: НДА, аренда, трудовой, поставка. Заполняете форму — получаете грамотный DOCX.",
    cta: "Открыть шаблоны",
    href: "/templates",
  },
  {
    icon: MessageCircle,
    title: "Спросить юриста-AI",
    description:
      "Чат с AI, который ссылается на статьи ГК / НК / ТК РФ. Без воды, по делу.",
    cta: "Открыть чат",
    href: "/chat",
  },
];

export function OnboardingModal() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);

  // Show only once per browser. Tied to the user being authenticated —
  // a logged-out viewer on the landing page sees the marketing copy,
  // they don't need a tour.
  useEffect(() => {
    if (status !== "authenticated") return;
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) {
        // Tiny delay so the modal doesn't flash before the page has
        // settled; lets the dashboard render first then announce itself.
        const timer = setTimeout(() => setOpen(true), 600);
        return () => clearTimeout(timer);
      }
    } catch {
      // localStorage may throw in private mode — silently skip the
      // tour rather than show it on every page load.
    }
  }, [status]);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // ignore
    }
    setOpen(false);
  };

  if (!session?.user) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[105] flex items-center justify-center bg-foreground/40 backdrop-blur-sm px-4 py-6"
          onClick={dismiss}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-heading"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 360, damping: 32, mass: 0.8 }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            <button
              type="button"
              onClick={dismiss}
              aria-label="Закрыть"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>

            <div className="shrink-0 px-6 pt-8 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Добро пожаловать{session.user.name ? `, ${session.user.name.split(" ")[0]}` : ""}
              </p>
              <h2
                id="onboarding-heading"
                className="mt-2 text-2xl font-extrabold tracking-tight text-foreground"
              >
                Что в ЮрИИст можно сделать
              </h2>
              <p className="mt-2 text-sm text-muted">
                Три типичных сценария — выберите, с чего начать.
              </p>
            </div>

            <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-6 sm:grid-cols-3">
              {STEPS.map((step) => (
                <Link
                  key={step.href}
                  href={step.href}
                  onClick={dismiss}
                  className="group flex flex-col rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/40 hover:bg-card-hover"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light text-primary transition-colors group-hover:bg-primary group-hover:text-primary-fg">
                    <step.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-1 flex-1 text-xs leading-relaxed text-muted">
                    {step.description}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                    {step.cta}
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </span>
                </Link>
              ))}
            </div>

            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border bg-surface/60 px-6 py-3 text-xs text-muted sm:justify-between">
              <span className="hidden sm:inline">
                Подсказка: ⌘K открывает поиск по всему сервису
              </span>
              <button
                type="button"
                onClick={dismiss}
                className="font-semibold text-primary transition-colors hover:text-primary-dark"
              >
                Пропустить
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
