"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  Sparkles,
  Loader2,
  FileText,
  ArrowRight,
  X,
} from "lucide-react";

interface SearchFragment {
  chunkIndex: number;
  similarity: number | null;
  preview: string;
}

interface SearchHit {
  documentId: string;
  fileName: string;
  createdAt: string;
  similarity: number | null;
  fragments: SearchFragment[];
}

interface SearchResponse {
  mode: "semantic" | "keyword";
  results: SearchHit[];
  note?: string;
}

const DEBOUNCE_MS = 350;

export function DocumentSearchBar() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close the result dropdown on outside-click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Debounced search — fire request 350 ms after the user stops typing.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setData(null);
      return;
    }

    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/documents/search?q=${encodeURIComponent(trimmed)}&limit=8`
        );
        if (!response.ok) throw new Error(String(response.status));
        const json = (await response.json()) as SearchResponse;
        if (!cancelled) {
          setData(json);
          setOpen(true);
        }
      } catch {
        if (!cancelled) setData({ mode: "keyword", results: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  const clear = () => {
    setQuery("");
    setData(null);
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
        <Search className="h-4 w-4 shrink-0 text-muted" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => data && setOpen(true)}
          placeholder="Поиск по договорам"
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted/60 focus:outline-none"
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        {query && !loading && (
          <button
            onClick={clear}
            className="text-muted hover:text-foreground"
            title="Очистить"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && data && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-[28rem] overflow-y-auto rounded-xl border border-border bg-card shadow-xl">
          {/* Mode + note */}
          <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs">
            <span className="flex items-center gap-1.5 text-muted">
              {data.mode === "semantic" ? (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Семантический поиск
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5" />
                  Поиск по словам
                </>
              )}
            </span>
            <span className="text-muted">
              {data.results.length}{" "}
              {data.results.length === 1
                ? "результат"
                : data.results.length < 5 && data.results.length > 0
                  ? "результата"
                  : "результатов"}
            </span>
          </div>

          {data.note && (
            <p className="border-b border-border bg-warning-light px-4 py-2 text-xs text-warning">
              {data.note}
            </p>
          )}

          {data.results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              Ничего не найдено. Попробуйте переформулировать.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {data.results.map((hit) => (
                <li key={hit.documentId}>
                  <Link
                    href={`/report/${hit.documentId}`}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 transition-colors hover:bg-surface"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-2">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {hit.fileName}
                          </p>
                          {hit.fragments[0] && (
                            <p className="mt-1 line-clamp-2 text-xs text-muted">
                              {hit.fragments[0].preview}
                            </p>
                          )}
                          {hit.fragments.length > 1 && (
                            <p className="mt-0.5 text-[10px] text-muted">
                              + ещё {hit.fragments.length - 1} совпадени
                              {hit.fragments.length === 2 ? "е" : "я"}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {typeof hit.similarity === "number" && (
                          <span
                            className="rounded-md bg-primary-light px-1.5 py-0.5 text-[10px] font-bold text-primary-dark"
                            title={`Релевантность: ${hit.similarity.toFixed(3)}`}
                          >
                            {Math.round(hit.similarity * 100)}%
                          </span>
                        )}
                        <ArrowRight className="h-3.5 w-3.5 text-muted" />
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
