"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
import { ArrowLeft, Loader2 } from "lucide-react";

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
      ? "bg-red-200/80 text-red-900 rounded px-0.5"
      : "bg-green-200/80 text-green-900 rounded px-0.5";
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
      <div className="flex min-h-full flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (error || !comparison) {
    return (
      <div className="flex min-h-full flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
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
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <Header />

      <main className="flex-1 bg-surface/30">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href={`/generated/${docId}/versions`}
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Вернуться к версиям
          </Link>

          <h1 className="mb-4 text-3xl font-bold text-foreground">
            Сравнение версий
          </h1>

          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="mb-3 text-sm font-semibold text-blue-900">
              {comparison.v1.title} → {comparison.v2.title}
            </p>
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
                <span className="h-3 w-3 rounded bg-amber-500" />
                Изменено: {comparison.diff.changed}
              </span>
            </div>
            <p className="mt-2 text-xs text-blue-900/70">
              Подсветка показывает изменения на уровне отдельных слов:
              удалённые — красным, добавленные — зелёным.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-white">
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
                      className="flex border-b border-border bg-green-50 font-mono text-xs"
                    >
                      <div className="w-14 select-none border-r border-border bg-surface px-3 py-1 text-right text-muted tabular-nums">
                        {hunk.newLineNumber}
                      </div>
                      <div className="w-8 select-none border-r border-border px-2 py-1 text-center font-bold text-green-700">
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
                      className="flex border-b border-border bg-red-50 font-mono text-xs"
                    >
                      <div className="w-14 select-none border-r border-border bg-surface px-3 py-1 text-right text-muted tabular-nums">
                        {hunk.oldLineNumber}
                      </div>
                      <div className="w-8 select-none border-r border-border px-2 py-1 text-center font-bold text-red-700">
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
                    <div className="flex border-b border-border bg-red-50 font-mono text-xs">
                      <div className="w-14 select-none border-r border-border bg-surface px-3 py-1 text-right text-muted tabular-nums">
                        {hunk.oldLineNumber}
                      </div>
                      <div className="w-8 select-none border-r border-border px-2 py-1 text-center font-bold text-red-700">
                        −
                      </div>
                      <div className="flex-1 whitespace-pre-wrap break-words px-3 py-1 text-foreground">
                        {renderTokens(hunk.oldTokens, "removed")}
                      </div>
                    </div>
                    <div className="flex border-b border-border bg-green-50 font-mono text-xs">
                      <div className="w-14 select-none border-r border-border bg-surface px-3 py-1 text-right text-muted tabular-nums">
                        {hunk.newLineNumber}
                      </div>
                      <div className="w-8 select-none border-r border-border px-2 py-1 text-center font-bold text-green-700">
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
              className="rounded-lg border border-border bg-white px-6 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
            >
              Вернуться к версиям
            </Link>
          </div>
        </div>
      </main>

      <Disclaimer />
    </div>
  );
}
