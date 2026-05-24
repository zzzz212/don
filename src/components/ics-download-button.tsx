"use client";

import { Calendar } from "lucide-react";

interface Props {
  documentId: string;
  hasDeadlines: boolean;
}

export function IcsDownloadButton({ documentId, hasDeadlines }: Props) {
  if (!hasDeadlines) {
    return (
      <button
        type="button"
        disabled
        title="Сначала запустите AI-сканирование дедлайнов"
        className="inline-flex items-center gap-2 text-sm text-ink-quiet/60 cursor-not-allowed"
      >
        <Calendar className="h-4 w-4" aria-hidden />
        В календарь — нет дат
      </button>
    );
  }
  return (
    <a
      href={`/api/documents/${documentId}/deadlines.ics`}
      className="inline-flex items-center gap-2 text-sm text-foreground hover:text-primary"
    >
      <Calendar className="h-4 w-4" aria-hidden />
      Скачать в календарь
    </a>
  );
}
