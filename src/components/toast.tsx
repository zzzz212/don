"use client";

// Tiny in-app toast system. Replaces window.alert() for non-blocking
// error / success feedback. Keep it minimal — single global provider,
// stack at top-right, auto-dismiss after 5s.
//
// Usage:
//   const toast = useToast();
//   toast.error("Не удалось сохранить");
//   toast.success("Сохранено");

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { CheckCircle2, AlertCircle, X, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: number;
  variant: ToastVariant;
  message: string;
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
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
    (message: string, variant: ToastVariant = "info") => {
      counter.current += 1;
      const id = counter.current;
      setToasts((prev) => [...prev, { id, variant, message }]);
      // Auto-dismiss. Toast can also be closed manually via the X.
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  const value: ToastContextValue = {
    show,
    success: (m) => show(m, "success"),
    error: (m) => show(m, "error"),
    info: (m) => show(m, "info"),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 top-20 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
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

  // Mount-time fade-in. Tailwind's `animate-fade-in` keyframe is in
  // globals.css; reusing it keeps the look consistent with other UI.
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-card p-3 pr-2 shadow-lg animate-fade-in",
        s.bg,
        s.border
      )}
    >
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", s.text)} />
      <p className={cn("flex-1 text-sm leading-relaxed", s.text)}>
        {toast.message}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded p-1 text-muted transition-colors hover:bg-black/5 hover:text-foreground"
        aria-label="Закрыть уведомление"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
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
