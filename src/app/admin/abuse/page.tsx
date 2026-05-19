"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  Loader2,
  AlertCircle,
  Fingerprint,
  Globe,
} from "lucide-react";

interface FlaggedUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  signupIp: string | null;
  fingerprintShort: string | null;
  abuseScore: number;
  trialActivated: boolean;
  ipClusterSize: number;
  fingerprintClusterSize: number;
}

interface Cluster {
  key: string;
  count: number;
}

interface AbuseData {
  flagged: FlaggedUser[];
  fingerprintClusters: Cluster[];
  ipClusters: Cluster[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function scoreClass(score: number): string {
  if (score >= 70) return "bg-danger-light text-danger";
  if (score >= 50) return "bg-warning-light text-warning";
  return "bg-surface text-muted";
}

export default function AdminAbusePage() {
  const [data, setData] = useState<AbuseData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/abuse")
      .then(async (r) => {
        if (r.status === 403) {
          setError("Доступ запрещён. Страница только для администраторов.");
          return;
        }
        if (!r.ok) {
          setError(`Не удалось загрузить данные (${r.status})`);
          return;
        }
        setData((await r.json()) as AbuseData);
      })
      .catch(() => setError("Сеть недоступна."));
  }, []);

  return (
    <AppShell>
      <PageHeader
        title="Анти-абуз"
        description="Аккаунты с подозрением на фарм бесплатного периода и кластеры по IP / отпечатку устройства. Ничего не блокируется автоматически — это очередь для ручной проверки."
      />
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">

          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-light px-4 py-3 text-sm text-danger"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {data === null && !error && (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted" />
            </div>
          )}

          {data && (
            <div className="space-y-8">
              <section>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">
                  Помеченные аккаунты ({data.flagged.length})
                </h2>
                {data.flagged.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-card py-12 text-center text-sm text-muted">
                    Подозрительных активаций триала не обнаружено.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-border bg-card">
                    <div className="-mx-4 overflow-x-auto sm:mx-0">
                      <table className="w-full min-w-[640px] text-sm">
                        <thead>
                          <tr className="border-b border-border bg-surface/50 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                            <th className="px-4 py-3">Аккаунт</th>
                            <th className="px-4 py-3">Регистрация</th>
                            <th className="px-4 py-3">IP / устройство</th>
                            <th className="px-4 py-3 text-right">Риск</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.flagged.map((u) => (
                            <tr
                              key={u.id}
                              className="border-b border-border last:border-0 hover:bg-surface/40"
                            >
                              <td className="px-4 py-3">
                                <Link
                                  href={`/admin/users/${u.id}`}
                                  className="font-medium text-primary hover:text-primary-dark"
                                >
                                  {u.email}
                                </Link>
                                {u.name && (
                                  <div className="text-xs text-muted">
                                    {u.name}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-muted">
                                {formatDate(u.createdAt)}
                              </td>
                              <td className="px-4 py-3 text-xs text-muted">
                                <div>
                                  IP {u.signupIp ?? "—"}
                                  {u.ipClusterSize > 1 && (
                                    <span className="ml-1 text-warning">
                                      ×{u.ipClusterSize}
                                    </span>
                                  )}
                                </div>
                                <div className="font-mono">
                                  {u.fingerprintShort ?? "—"}
                                  {u.fingerprintClusterSize > 1 && (
                                    <span className="ml-1 text-danger">
                                      ×{u.fingerprintClusterSize}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span
                                  className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold tabular-nums ${scoreClass(
                                    u.abuseScore
                                  )}`}
                                >
                                  {u.abuseScore}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>

              <div className="grid gap-6 sm:grid-cols-2">
                <section>
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted">
                    <Fingerprint className="h-4 w-4" />
                    Кластеры по устройству
                  </h2>
                  <div className="rounded-2xl border border-border bg-card p-2">
                    {data.fingerprintClusters.length === 0 ? (
                      <p className="px-2 py-4 text-center text-sm text-muted">
                        Совпадений нет.
                      </p>
                    ) : (
                      data.fingerprintClusters.map((c) => (
                        <div
                          key={c.key}
                          className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm"
                        >
                          <span className="font-mono text-xs text-muted">
                            {c.key}…
                          </span>
                          <span className="font-bold text-danger tabular-nums">
                            {c.count} акк.
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section>
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted">
                    <Globe className="h-4 w-4" />
                    Кластеры по IP
                  </h2>
                  <div className="rounded-2xl border border-border bg-card p-2">
                    {data.ipClusters.length === 0 ? (
                      <p className="px-2 py-4 text-center text-sm text-muted">
                        Совпадений нет.
                      </p>
                    ) : (
                      data.ipClusters.map((c) => (
                        <div
                          key={c.key}
                          className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm"
                        >
                          <span className="font-mono text-xs text-muted">
                            {c.key}
                          </span>
                          <span className="font-bold text-warning tabular-nums">
                            {c.count} акк.
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </AppShell>
  );
}
