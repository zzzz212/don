"use client";

import { AlertTriangle } from "lucide-react";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-20">
      <div className="text-center max-w-md">
        <AlertTriangle className="h-12 w-12 text-warning mx-auto mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">
          Что-то пошло не так
        </h2>
        <p className="text-sm text-muted mb-6">
          Произошла непредвиденная ошибка. Попробуйте обновить страницу.
        </p>
        <button
          onClick={reset}
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          Попробовать снова
        </button>
      </div>
    </div>
  );
}
