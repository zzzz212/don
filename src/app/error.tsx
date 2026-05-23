"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Home, RotateCw } from "lucide-react";
import { reportError } from "@/lib/telemetry";
import { Button, buttonClass } from "@/components/button";

// Top-level error boundary for the App Router. Branded chrome with
// a "try again" + "home" pair. We also forward the error to Sentry
// so an uncaught render error doesn't go silently into the user's
// console only — same hook the API routes use.

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void reportError(error, {
      op: "render-boundary",
      tags: { digest: error.digest ?? "—" },
    });
  }, [error]);

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-surface/30 px-4 py-20">
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <svg
          viewBox="0 0 200 120"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Произошла ошибка"
          className="h-32 w-auto text-warning"
        >
          <text
            x="50%"
            y="58%"
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="Inter, system-ui, sans-serif"
            fontWeight="800"
            fontSize="68"
            letterSpacing="-2"
            className="fill-current"
          >
            500
          </text>
          <path
            d="M 38 30 L 56 56 L 38 56 Z"
            className="fill-card stroke-current"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <line
            x1="47"
            y1="40"
            x2="47"
            y2="48"
            className="stroke-current"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="47" cy="52.5" r="1.5" className="fill-current" />
        </svg>

        <h1 className="mt-8 text-3xl font-semibold tracking-tight text-foreground">
          Что-то пошло не так
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
          На сервере произошла непредвиденная ошибка. Мы уже знаем — попробуйте
          обновить страницу или вернуться к дашборду.
          {error.digest && (
            <>
              {" "}
              <span className="block mt-2 text-xs font-mono text-muted/70">
                Код инцидента: {error.digest}
              </span>
            </>
          )}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset}>
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            Попробовать снова
          </Button>
          <Link
            href="/dashboard"
            className={buttonClass({ variant: "secondary" })}
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            На дашборд
          </Link>
        </div>
      </div>
    </div>
  );
}
