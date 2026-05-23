"use client";

// Tiny in-app toast system. Replaces window.alert() for non-blocking
// error / success feedback. Single global provider, stack at top-right,
// auto-dismiss after 5s.
//
// Each toast may carry an inline action ({label, onClick}) — handy for
// destructive ops where we offer Undo, or for "Открыть документ" right
// after a generation finishes.
//
// Usage:
//   const toast = useToast();
//   toast.error("Не удалось сохранить");
//   toast.success("Сохранено");
//   toast.success("Документ удалён", { action: { label: "Отменить", onClick: undo } });

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, AlertCircle, X, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** Override the default 5s auto-dismiss window. 0 = never dismiss. */
  durationMs?: number;
  /** Inline action button rendered next to the close button. */
  action?: ToastAction;
}

interface Toast {
  id: number;
  variant: ToastVariant;
  message: string;
  action?: ToastAction;
  durationMs: number;
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant, options?: ToastOptions) => void;
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (
      message: string,
      variant: ToastVariant = "info",
      options: ToastOptions = {}
    ) => {
      counter.current += 1;
      const id = counter.current;
      const durationMs = options.durationMs ?? AUTO_DISMISS_MS;
      setToasts((prev) => [
        ...prev,
        { id, variant, message, action: options.action, durationMs },
      ]);
      if (durationMs > 0) {
        setTimeout(() => dismiss(id), durationMs);
      }
    },
    [dismiss]
  );

  const value: ToastContextValue = {
    show,
    success: (m, o) => show(m, "success", o),
    error: (m, o) => show(m, "error", o),
    info: (m, o) => show(m, "info", o),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 top-20 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const styles: Record<
    ToastVariant,
    {
      bg: string;
      border: string;
      text: string;
      icon: typeof CheckCircle2;
    }
  > = {
    success: {
      bg: "bg-success/10",
      border: "border-success/30",
      text: "text-success",
      icon: CheckCircle2,
    },
    error: {
      bg: "bg-danger-light",
      border: "border-danger/30",
      text: "text-danger",
      icon: AlertCircle,
    },
    info: {
      bg: "bg-primary-light",
      border: "border-primary/30",
      text: "text-primary-dark",
      icon: Info,
    },
  };
  const s = styles[toast.variant];
  const Icon = s.icon;

  return (
    <motion.div
      role="status"
      layout
      initial={{ opacity: 0, y: -12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 500, damping: 38, mass: 0.7 }}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-card p-3 pr-2 shadow-lg",
        s.bg,
        s.border
      )}
    >
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", s.text)} aria-hidden="true" />
      <p className={cn("flex-1 text-sm leading-relaxed", s.text)}>
        {toast.message}
      </p>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action!.onClick();
            onDismiss();
          }}
          className={cn(
            "shrink-0 rounded-md border px-2 py-1 text-xs font-semibold transition-colors hover:bg-foreground/5",
            s.border,
            s.text
          )}
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded p-1 text-muted transition-colors hover:bg-foreground/5 hover:text-foreground"
        aria-label="Закрыть уведомление"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </motion.div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Outside the provider — fall back to console so callers don't
    // crash if accidentally rendered above <ToastProvider>. UI just
    // misses the toast; the error still surfaces in DevTools.
    return {
      show: (m, v) => console.warn(`[toast:${v ?? "info"}]`, m),
      success: (m) => console.log("[toast:success]", m),
      error: (m) => console.error("[toast:error]", m),
      info: (m) => console.info("[toast:info]", m),
    };
  }
  return ctx;
}

/**
 * Hook into the toast system from anywhere — even outside React (e.g.
 * fetch interceptors). Sets a singleton ref to the live toast api on
 * mount of the provider; clears on unmount. No effect when no provider
 * is mounted (SSR, tests).
 */
let globalToast: ToastContextValue | null = null;
export function getGlobalToast(): ToastContextValue | null {
  return globalToast;
}

export function ToastBridge() {
  const toast = useToast();
  useEffect(() => {
    globalToast = toast;
    return () => {
      if (globalToast === toast) globalToast = null;
    };
  }, [toast]);
  return null;
}
