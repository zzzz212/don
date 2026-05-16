"use client";

// A generated-document attachment rendered inside a chat message —
// shared by the workspace channel and direct-message threads.
//
// When the viewer can open the document (same workspace, or it's their
// own) pass `href`; otherwise pass `onCopy` so they can save a copy into
// their own workspace first.

import Link from "next/link";
import { FileText, Loader2, Download, FolderInput } from "lucide-react";

export function DocAttachmentCard({
  name,
  href,
  onCopy,
  copying = false,
}: {
  name: string;
  href?: string;
  onCopy?: () => void;
  copying?: boolean;
}) {
  return (
    <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light">
        <FileText className="h-4 w-4 text-primary-dark" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        <p className="text-xs text-muted">Документ из ЮрИИст</p>
      </div>
      {href ? (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-surface"
        >
          <Download className="h-3.5 w-3.5" />
          Открыть
        </Link>
      ) : onCopy ? (
        <button
          type="button"
          onClick={onCopy}
          disabled={copying}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-fg transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {copying ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FolderInput className="h-3.5 w-3.5" />
          )}
          Сохранить себе
        </button>
      ) : null}
    </div>
  );
}
