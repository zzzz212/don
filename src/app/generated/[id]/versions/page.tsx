"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
import {
  ArrowLeft,
  Loader2,
  GitBranch,
  Clock,
  Users,
  RotateCcw,
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

export default function DocumentVersionsPage() {
  const params = useParams();
  const router = useRouter();
  const docId = params.id as string;

  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedV1, setSelectedV1] = useState<string | null>(null);
  const [selectedV2, setSelectedV2] = useState<string | null>(null);
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

  const handleCompare = () => {
    if (selectedV1 && selectedV2) {
      router.push(
        `/generated/${docId}/compare/${selectedV1}/${selectedV2}`
      );
    }
  };

  const handleRevert = async (versionId: string) => {
    if (!confirm("Вы уверены? Будет создана новая версия на основе выбранной."))
      return;

    try {
      const response = await fetch("/api/versions/revert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });

      if (response.ok) {
        const data = await response.json();
        setVersions([...versions, data.version]);
      } else {
        setError("Ошибка при восстановлении версии");
      }
    } catch (err) {
      setError("Ошибка при восстановлении версии");
      console.error(err);
    }
  };

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

  return (
    <div className="flex min-h-full flex-col">
      <Header />

      <main className="flex-1 bg-surface/30">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Back link */}
          <Link
            href={`/generated/${docId}`}
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Вернуться к документу
          </Link>

          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
            <GitBranch className="h-8 w-8" />
            История версий
          </h1>
          <p className="text-muted mb-8">
            {versions.length} версия{versions.length % 10 === 1 && versions.length % 100 !== 11 ? "" : "й"}
          </p>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4 text-red-800">
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {versions.length === 0 ? (
            <div className="text-center py-12">
              <GitBranch className="h-16 w-16 text-muted mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Нет версий
              </h3>
              <p className="text-muted">
                Начните редактировать документ, чтобы создать первую версию
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Version list */}
              <div className="bg-white rounded-lg border border-border p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  Все версии
                </h2>
                <div className="space-y-3">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-surface transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <input
                            type="radio"
                            name="v1"
                            value={version.id}
                            checked={selectedV1 === version.id}
                            onChange={(e) => setSelectedV1(e.target.value)}
                            className="cursor-pointer"
                          />
                          <span className="text-sm font-semibold text-foreground">
                            v{version.versionNumber}: {version.title}
                          </span>
                        </div>
                        {version.changesSummary && (
                          <p className="text-xs text-muted ml-6 mb-2">
                            {version.changesSummary}
                          </p>
                        )}
                        <div className="flex gap-3 text-xs text-muted ml-6">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(version.createdAt).toLocaleDateString(
                              "ru-RU"
                            )}
                          </span>
                          {version.creator && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {version.creator.name || version.creator.email}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <input
                          type="radio"
                          name="v2"
                          value={version.id}
                          checked={selectedV2 === version.id}
                          onChange={(e) => setSelectedV2(e.target.value)}
                          className="cursor-pointer"
                        />
                        <button
                          onClick={() => handleRevert(version.id)}
                          className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface"
                          title="Восстановить эту версию"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Compare section */}
              <div className="bg-white rounded-lg border border-border p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  Сравнить версии
                </h2>
                <p className="text-sm text-muted mb-4">
                  Выберите две версии для сравнения (отметьте на левой и правой стороне)
                </p>
                <button
                  onClick={handleCompare}
                  disabled={!selectedV1 || !selectedV2}
                  className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
                >
                  Сравнить выбранные версии
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <Disclaimer />
    </div>
  );
}
