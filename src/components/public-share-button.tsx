"use client";

// "Share by link" action on the analysis report. Creates / shows /
// revokes a public read-only link to the contract's analysis.

import { useState } from "react";
import { Share2, Loader2, X, Copy, Check, Link2Off } from "lucide-react";

interface ShareLink {
  url: string;
  viewCount: number;
}

export function PublicShareButton({ documentId }: { documentId: string }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<ShareLink | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openModal() {
    setOpen(true);
    setError(null);
    setCopied(false);
    setLoaded(false);
    fetch(`/api/documents/${documentId}/public-share`)
      .then((r) => (r.ok ? r.json() : { share: null }))
      .then((d) => setLink(d.share))
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/documents/${documentId}/public-share`, {
        method: "POST",
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error ?? "Не удалось создать ссылку");
        return;
      }
      setLink(d.share);
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/documents/${documentId}/public-share`, {
        method: "DELETE",
      });
      if (!r.ok) {
        setError("Не удалось отозвать ссылку");
        return;
      }
      setLink(null);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the field is selectable as a fallback */
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
      >
        <Share2 className="h-4 w-4" />
        Поделиться ссылкой
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between">
              <h2 className="text-base font-bold text-foreground">
                Публичная ссылка на заключение
              </h2>
              <button
                type="button"
                onClick={() => !busy && setOpen(false)}
                aria-label="Закрыть"
                className="text-muted transition-colors hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-4 text-xs text-muted">
              Любой, у кого есть ссылка, увидит вердикт и риски по договору
              в режиме только для чтения. Текст самого договора не
              показывается. Ссылка действует 90 дней; вы можете отозвать
              её в любой момент.
            </p>

            {error && (
              <p className="mb-3 text-xs text-danger">{error}</p>
            )}

            {!loaded ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted" />
              </div>
            ) : link ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={link.url}
                    onFocus={(e) => e.currentTarget.select()}
                    className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
                  />
                  <button
                    type="button"
                    onClick={copy}
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-dark"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copied ? "Скопировано" : "Копировать"}
                  </button>
                </div>
                <p className="text-xs text-muted">
                  Просмотров по ссылке: {link.viewCount}
                </p>
                <button
                  type="button"
                  onClick={revoke}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-danger transition-colors hover:underline disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Link2Off className="h-4 w-4" />
                  )}
                  Отозвать ссылку
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={create}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-dark disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
                Создать публичную ссылку
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
