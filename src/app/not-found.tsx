import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { buttonClass } from "@/components/button";

// Custom 404 — branded chrome with an inline SVG that picks up the
// theme palette via currentColor + fill-card. We don't render Header /
// Disclaimer here because not-found can be triggered for routes that
// would have wrapped them itself; keeping the page chrome-free avoids
// a duplicated header on those edges.

export default function NotFoundPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-surface/30 px-4 py-20">
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <svg
          viewBox="0 0 200 120"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Страница не найдена"
          className="h-32 w-auto text-primary"
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
            404
          </text>
          <circle
            cx="44"
            cy="40"
            r="14"
            className="fill-card stroke-current"
            strokeWidth="2.5"
          />
          <line
            x1="55"
            y1="51"
            x2="68"
            y2="64"
            className="stroke-current"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>

        <h1 className="mt-8 text-3xl font-semibold tracking-tight text-foreground">
          Страница не найдена
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
          Адрес неверный или страницу удалили. Попробуйте поиск через ⌘K
          или вернитесь к дашборду.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className={buttonClass({ variant: "secondary" })}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            На главную
          </Link>
          <Link href="/dashboard" className={buttonClass()}>
            <Search className="h-4 w-4" aria-hidden="true" />
            Открыть дашборд
          </Link>
        </div>
      </div>
    </div>
  );
}
