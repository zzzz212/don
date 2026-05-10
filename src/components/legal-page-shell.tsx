// Shared chrome for the public legal pages (/privacy, /terms, /offer).
// Renders header + footer (so anonymous visitors land on a familiar layout
// even when they came from outside via a ЮKassa receipt link), a sticky
// table of contents on desktop, and prose-styled body content.

import Link from "next/link";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
import { LEGAL_EFFECTIVE_DATE } from "@/lib/legal-info";

interface TocEntry {
  id: string;
  title: string;
}

interface Props {
  title: string;
  /** One-sentence subtitle shown under the H1. */
  description?: string;
  /** Date of last revision in YYYY-MM-DD; defaults to LEGAL_EFFECTIVE_DATE. */
  effectiveDate?: string;
  toc: TocEntry[];
  children: React.ReactNode;
}

function formatDate(iso: string): string {
  // Render YYYY-MM-DD as "10 мая 2026" — clearer for the reader than ISO.
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  return `${d} ${months[m - 1]} ${y} г.`;
}

export function LegalPageShell({
  title,
  description,
  effectiveDate = LEGAL_EFFECTIVE_DATE,
  toc,
  children,
}: Props) {
  return (
    <div className="flex min-h-full flex-col bg-white">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="mb-10 max-w-3xl">
            <p className="mb-3 text-sm font-medium text-primary">
              <Link href="/" className="hover:underline">
                ← На главную
              </Link>
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {title}
            </h1>
            {description && (
              <p className="mt-3 text-base text-muted">{description}</p>
            )}
            <p className="mt-4 text-sm text-muted">
              Дата вступления в силу: {formatDate(effectiveDate)}
            </p>
          </div>

          <div className="grid gap-10 lg:grid-cols-[18rem_minmax(0,1fr)]">
            {/* Sticky TOC — desktop only */}
            <aside className="hidden lg:block">
              <nav
                aria-label="Содержание"
                className="sticky top-24 rounded-2xl border border-border bg-surface/50 p-5"
              >
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
                  Содержание
                </p>
                <ol className="space-y-2 text-sm">
                  {toc.map((entry, idx) => (
                    <li key={entry.id} className="leading-snug">
                      <a
                        href={`#${entry.id}`}
                        className="block text-muted hover:text-foreground hover:underline"
                      >
                        <span className="mr-1 tabular-nums text-muted/70">
                          {idx + 1}.
                        </span>
                        {entry.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </aside>

            <article className="prose-legal max-w-3xl">{children}</article>
          </div>
        </div>
      </main>

      <Disclaimer />
    </div>
  );
}
