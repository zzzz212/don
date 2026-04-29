"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
import { ArrowLeft, Loader2, ChevronUp, ChevronDown } from "lucide-react";

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  lineNumber: number;
}

interface ComparisonData {
  v1: {
    id: string;
    versionNumber: number;
    title: string;
  };
  v2: {
    id: string;
    versionNumber: number;
    title: string;
  };
  diff: {
    added: number;
    removed: number;
    changed: number;
    lines: DiffLine[];
  };
}

export default function CompareVersionsPage() {
  const params = useParams();
  const router = useRouter();
  const docId = params.id as string;
  const v1Id = params.v1 as string;
  const v2Id = params.v2 as string;

  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedSection, setExpandedSection] = useState<number | null>(null);

  useEffect(() => {
    async function loadComparison() {
      try {
        const response = await fetch("/api/versions/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ v1Id, v2Id }),
        });

        if (response.ok) {
          const data = await response.json();
          setComparison(data);
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
            <h1 className="text-xl font-bold text-foreground mb-4">
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

  const getLineColor = (type: string) => {
    switch (type) {
      case "added":
        return "bg-green-50";
      case "removed":
        return "bg-red-50";
      default:
        return "bg-white";
    }
  };

  const getLineIndicator = (type: string) => {
    switch (type) {
      case "added":
        return <span className="text-green-700 font-bold">+</span>;
      case "removed":
        return <span className="text-red-700 font-bold">−</span>;
      default:
        return <span className="text-muted"> </span>;
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <Header />

      <main className="flex-1 bg-surface/30">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Back link */}
          <Link
            href={`/generated/${docId}/versions`}
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Вернуться к версиям
          </Link>

          <h1 className="text-3xl font-bold text-foreground mb-4">
            Сравнение версий
          </h1>

          {/* Summary */}
          <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-blue-900">
                  {comparison.v1.title} → {comparison.v2.title}
                </p>
              </div>
            </div>
            <div className="flex gap-6 text-sm">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-green-600"></span>
                Добавлено: {comparison.diff.added}
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-red-600"></span>
                Удалено: {comparison.diff.removed}
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-yellow-600"></span>
                Изменено: {comparison.diff.changed}
              </span>
            </div>
          </div>

          {/* Diff view */}
          <div className="bg-white rounded-lg border border-border overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              {comparison.diff.lines.map((line, idx) => (
                <div
                  key={idx}
                  className={`flex font-mono text-xs border-b border-border ${getLineColor(
                    line.type
                  )}`}
                >
                  <div className="w-12 bg-surface text-muted text-right px-3 py-1 select-none border-r border-border">
                    {line.lineNumber}
                  </div>
                  <div className="w-8 px-2 py-1 text-center select-none border-r border-border">
                    {getLineIndicator(line.type)}
                  </div>
                  <div className="flex-1 px-3 py-1 text-foreground break-words whitespace-pre-wrap">
                    {line.content}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
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
