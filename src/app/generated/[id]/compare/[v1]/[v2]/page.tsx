"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Loader2 } from "lucide-react";

type WordToken = {
  type: "context" | "removed" | "added";
  text: string;
};

type DiffHunk =
  | {
      type: "context";
      content: string;
      oldLineNumber: number;
      newLineNumber: number;
    }
  | {
      type: "removed";
      content: string;
      oldLineNumber: number;
    }
  | {
      type: "added";
      content: string;
      newLineNumber: number;
    }
  | {
      type: "modified";
      oldContent: string;
      newContent: string;
      oldLineNumber: number;
      newLineNumber: number;
      oldTokens: WordToken[];
      newTokens: WordToken[];
    };

interface ComparisonData {
  v1: { id: string; versionNumber: number; title: string };
  v2: { id: string; versionNumber: number; title: string };
  diff: {
    added: number;
    removed: number;
    changed: number;
    hunks: DiffHunk[];
  };
}

function renderTokens(tokens: WordToken[], emphasisType: "removed" | "added") {
  const emphasisClass =
    emphasisType === "removed"
      ? "bg-red-200/80 text-danger dark:bg-red-500/25 dark:text-red-200 rounded px-0.5"
      : "bg-green-200/80 text-success dark:bg-emerald-500/25 dark:text-emerald-200 rounded px-0.5";
  return tokens.map((tok, i) => {
    if (tok.type === "context") {
      return <span key={i}>{tok.text}</span>;
    }
    return (
      <span key={i} className={emphasisClass}>
        {tok.text}
      </span>
    );
  });
}

export default function CompareVersionsPage() {
  const params = useParams();
  const docId = params.id as string;
  const v1Id = params.v1 as string;
  const v2Id = params.v2 as string;

  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadComparison() {
      try {
        const response = await fetch("/api/versions/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ v1Id, v2Id }),
        });
        if (response.ok) {
          setComparison(await response.json());
        } else {
          setError("Ошибка при загрузке сравнения");
        }
      } catch (err) {
        setError("Ошибка при загрузке сравнения");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadComparison();
  }, [v1Id, v2Id]);

  if (loading) {
    return (
      <AppShell>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </AppShell>
    );
  }

  if (error || !comparison) {
    return (
      <AppShell>
          <div className="text-center">
            <h1 className="mb-4 text-xl font-bold text-foreground">
              {error || "Сравнение не найдено"}
            </h1>
            <Link
              href={`/generated/${docId}/versions`}
              className="inline-flex text-sm text-primary hover:underline"
            >
              Вернуться к версиям
            </Link>
          </div>
        </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Сравнение версий"
        description={`${comparison.v1.title} → ${comparison.v2.title}`}
      />
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <Breadcrumbs
            items={[
              { label: "Документ", href: `/generated/${docId}` },
              { label: "Версии", href: `/generated/${docId}/versions` },
              { label: "Сравнение" },
            ]}
          />

          <div className="mb-6 rounded-xl border border-primary/30 bg-primary-light p-4">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-green-600" />
                Добавлено: {comparison.diff.added}
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-red-600" />
                Удалено: {comparison.diff.removed}
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-warning" />
                Изменено: {comparison.diff.changed}
              </span>
            </div>
            <p className="mt-2 text-xs text-primary-dark/70">
              Подсветка показывает изменения на уровне отдельных слов:
              удалённые — красным, добавленные — зелёным.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="max-h-[70vh] overflow-y-auto">
              {comparison.diff.hunks.map((hunk, idx) => {
                if (hunk.type === "context") {
                  return (
                    <div
                      key={idx}
                      className="flex border-b border-border font-mono text-xs"
                    >
                      <div className="w-14 select-none border-r border-border bg-surface px-3 py-1 text-right text-muted tabular-nums">
                        {hunk.oldLineNumber}
                      </div>
                      <div className="w-8 select-none border-r border-border px-2 py-1 text-center text-muted">
                        {" "}
                      </div>
                      <div className="flex-1 whitespace-pre-wrap break-words px-3 py-1 text-foreground">
                        {hunk.content}
                      </div>
                    </div>
                  );
                }
                if (hunk.type === "added") {
                  return (
                    <div
                      key={idx}
                      className="flex border-b border-border bg-success-light font-mono text-xs"
                    >
                      <div className="w-14 select-none border-r border-border bg-surface px-3 py-1 text-right text-muted tabular-nums">
                        {hunk.newLineNumber}
                      </div>
                      <div className="w-8 select-none border-r border-border px-2 py-1 text-center font-bold text-success">
                        +
                      </div>
                      <div className="flex-1 whitespace-pre-wrap break-words px-3 py-1 text-foreground">
                        {hunk.content}
                      </div>
                    </div>
                  );
                }
                if (hunk.type === "removed") {
                  return (
                    <div
                      key={idx}
                      className="flex border-b border-border bg-danger-light font-mono text-xs"
                    >
                      <div className="w-14 select-none border-r border-border bg-surface px-3 py-1 text-right text-muted tabular-nums">
                        {hunk.oldLineNumber}
                      </div>
                      <div className="w-8 select-none border-r border-border px-2 py-1 text-center font-bold text-danger">
                        −
                      </div>
                      <div className="flex-1 whitespace-pre-wrap break-words px-3 py-1 text-foreground">
                        {hunk.content}
                      </div>
                    </div>
                  );
                }
                // modified — render two stacked rows with word-level diff
                return (
                  <div key={idx}>
                    <div className="flex border-b border-border bg-danger-light font-mono text-xs">
                      <div className="w-14 select-none border-r border-border bg-surface px-3 py-1 text-right text-muted tabular-nums">
                        {hunk.oldLineNumber}
                      </div>
                      <div className="w-8 select-none border-r border-border px-2 py-1 text-center font-bold text-danger">
                        −
                      </div>
                      <div className="flex-1 whitespace-pre-wrap break-words px-3 py-1 text-foreground">
                        {renderTokens(hunk.oldTokens, "removed")}
                      </div>
                    </div>
                    <div className="flex border-b border-border bg-success-light font-mono text-xs">
                      <div className="w-14 select-none border-r border-border bg-surface px-3 py-1 text-right text-muted tabular-nums">
                        {hunk.newLineNumber}
                      </div>
                      <div className="w-8 select-none border-r border-border px-2 py-1 text-center font-bold text-success">
                        +
                      </div>
                      <div className="flex-1 whitespace-pre-wrap break-words px-3 py-1 text-foreground">
                        {renderTokens(hunk.newTokens, "added")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <Link
              href={`/generated/${docId}/versions`}
              className="rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
            >
              Вернуться к версиям
            </Link>
          </div>
        </div>
      </AppShell>
  );
}
