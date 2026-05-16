"use client";

// A dismissible "install the app" banner. On Chrome / Android / desktop
// it captures the native `beforeinstallprompt` event and triggers the
// real install dialog. iOS Safari never fires that event, so there it
// shows the manual "Share -> Add to Home Screen" hint instead. Dismissal
// is remembered so the banner never nags.

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "juriist:pwa-install-dismissed";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [iosHint, setIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Already running as an installed app — nothing to offer.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // localStorage blocked — fall through and show the banner once.
    }

    const onBeforeInstallPrompt = (e: Event) => {
      // Stop Chrome's own mini-infobar so we can place our own banner.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    // iOS Safari has no beforeinstallprompt — detect it and show the
    // manual instruction instead.
    const ua = window.navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    if (isIos && isSafari) {
      setIosHint(true);
      setVisible(true);
    }

    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // localStorage blocked — banner will reappear next session, fine.
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss();
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] p-3 print:hidden">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-xl">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-fg">
          <Download className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            Установить приложение
          </p>
          <p className="text-xs leading-snug text-muted">
            {iosHint
              ? "Нажмите «Поделиться», затем «На экран „Домой“»."
              : "Быстрый доступ с домашнего экрана — как обычное приложение."}
          </p>
        </div>
        {!iosHint && deferred && (
          <button
            type="button"
            onClick={install}
            className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-fg transition-colors hover:bg-primary-dark"
          >
            Установить
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Скрыть"
          className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
