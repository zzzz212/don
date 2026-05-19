"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  Loader2,
  GitBranch,
  Clock,
  Users,
  RotateCcw,
  GitCompareArrows,
  X,
} from "lucide-react";

interface DocumentVersion {
  id: string;
  versionNumber: number;
  title: string;
  changesSummary?: string;
  createdAt: string;
  creator?: {
    name?: string;
    email?: string;
  };
}

function pluralVersions(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return `${n} версия`;
  if (
    [2, 3, 4].includes(n % 10) &&
    ![12, 13, 14].includes(n % 100)
  ) {
    return `${n} версии`;
  }
  return `${n} версий`;
}

export default function DocumentVersionsPage() {
  const params = useParams();
  const router = useRouter();
  const docId = params.id as string;

  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  // Up to 2 selected ids — picking a 3rd evicts the oldest selection.
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadVersions() {
      try {
        const response = await fetch(`/api/generated/${docId}/versions`);
        if (response.ok) {
          const data = await response.json();
          setVersions(data.versions);
        } else if (response.status === 401) {
          router.push("/login");
        }
      } catch (err) {
        setError("Ошибка при загрузке версий");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadVersions();
  }, [docId, router]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length < 2) return [...prev, id];
      // Evict the first picked when picking a third.
      return [prev[1], id];
    });
  };

  const handleCompare = () => {
    if (selected.length !== 2) return;
    // Keep version-number order so older → newer in the diff direction.
    const versionsById = new Map(versions.map((v) => [v.id, v]));
    const sorted = [...selected].sort(
      (a, b) =>
        (versionsById.get(a)?.versionNumber ?? 0) -
        (versionsById.get(b)?.versionNumber ?? 0)
    );
    router.push(`/generated/${docId}/compare/${sorted[0]}/${sorted[1]}`);
  };

  const handleRevert = async (versionId: string) => {
    if (!confirm("Будет создана новая версия на основе выбранной. Продолжить?"))
      return;
    try {
      const response = await fetch("/api/versions/revert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      if (response.ok) {
        const data = await response.json();
        router.push(`/generated/${data.documentId ?? docId}`);
      } else {
        setError("Не удалось восстановить версию");
      }
    } catch (err) {
      setError("Не удалось восстановить версию");
      console.error(err);
    }
  };

  if (loading) {
    return (
      <AppShell>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </AppShell>
    );
  }

  const selectedVersions = selected
    .map((id) => versions.find((v) => v.id === id))
    .filter((v): v is DocumentVersion => !!v)
    .sort((a, b) => a.versionNumber - b.versionNumber);

  return (
    <AppShell>
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <Breadcrumbs
            items={[
              { label: "Созданные документы", href: "/dashboard" },
              { label: "Документ", href: `/generated/${docId}` },
              { label: "История версий" },
            ]}
          />

          <h1 className="mb-2 flex items-center gap-3 text-2xl font-bold text-foreground sm:text-3xl">
            <GitBranch className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden="true" />
            История версий
          </h1>
          <p className="mb-8 text-muted">
            {pluralVersions(versions.length)}. Отметьте две, чтобы сравнить
            изменения.
          </p>

          {error && (
            <div role="alert" className="mb-6 rounded-lg border border-danger/30 bg-danger-light p-4 text-danger">
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {versions.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card py-16 text-center">
              <GitBranch className="mx-auto mb-4 h-12 w-12 text-muted opacity-50" />
              <h3 className="mb-2 text-lg font-semibold text-foreground">
                Нет версий
              </h3>
              <p className="text-sm text-muted">
                Отредактируйте документ — система автоматически создаст версию.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version) => {
                const isSelected = selected.includes(version.id);
                return (
                  <div
                    key={version.id}
                    className={`flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors ${
                      isSelected
                        ? "border-primary ring-1 ring-primary"
                        : "border-border hover:bg-surface"
                    }`}
                  >
                    <label className="mt-1 inline-flex shrink-0 cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(version.id)}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                        aria-label={`Выбрать v${version.versionNumber} для сравнения`}
                      />
                    </label>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          v{version.versionNumber}
                        </span>
                        <span className="text-sm text-foreground">
                          {version.title}
                        </span>
                      </div>
                      {version.changesSummary && (
                        <p className="mt-1 text-xs text-muted">
                          {version.changesSummary}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(version.createdAt).toLocaleString("ru-RU", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {version.creator && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {version.creator.name || version.creator.email}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevert(version.id)}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface"
                      title="Создать новую версию из этой"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Восстановить
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      {/* Sticky compare bar — appears when 1+ version selected. */}
      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 text-sm">
              <GitCompareArrows className="h-4 w-4 text-primary" />
              {selected.length === 1 ? (
                <span className="text-muted">
                  Выбрана v{selectedVersions[0].versionNumber} —{" "}
                  отметьте ещё одну для сравнения.
                </span>
              ) : (
                <span className="text-foreground">
                  Сравнение:{" "}
                  <strong>
                    v{selectedVersions[0].versionNumber} ↔ v
                    {selectedVersions[1].versionNumber}
                  </strong>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelected([])}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface"
              >
                <X className="h-3.5 w-3.5" />
                Сбросить
              </button>
              <button
                type="button"
                onClick={handleCompare}
                disabled={selected.length !== 2}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
              >
                Сравнить
              </button>
            </div>
          </div>
        </div>
      )}

    </AppShell>
  );
}
