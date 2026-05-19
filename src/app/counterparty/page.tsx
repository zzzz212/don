"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ContactCounterparty } from "@/components/contact-counterparty";
import { buttonClass } from "@/components/button";
import { Badge } from "@/components/badge";
import {
  Search,
  Loader2,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
  Building2,
  Calendar,
  FileText,
  TrendingDown,
} from "lucide-react";

interface CounterpartyProfile {
  id: string;
  inn: string;
  name: string;
  organizationType?: string;
  registrationDate?: string;
  address?: string;
  okved?: string;
  capitalSize?: number;
  statusCode?: string;
  activeLawsuits: number;
  completedLawsuits: number;
  lossesCount: number;
  debtFound: boolean;
  debtAmount?: string;
  riskScore: number;
  riskLevel: string;
  riskFactors: string[];
  dataSource?: string;
}

export default function CounterpartyPage() {
  const [inn, setInn] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<CounterpartyProfile | null>(null);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const handleCheck = async () => {
    if (!inn.trim()) {
      setError("Введите ИНН");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/counterparty/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inn, forceRefresh: true }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Ошибка при проверке контрагента");
        setProfile(null);
        return;
      }

      const data = await response.json();
      setProfile(data.profile);
    } catch (err) {
      setError("Ошибка при проверке контрагента");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!profile) return;

    setSavingNotes(true);
    try {
      const response = await fetch(`/api/counterparty/${profile.inn}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: notes }),
      });

      if (!response.ok) {
        setError("Ошибка при сохранении комментария");
      }
    } catch (err) {
      setError("Ошибка при сохранении комментария");
      console.error(err);
    } finally {
      setSavingNotes(false);
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case "critical":
        return <AlertOctagon className="h-6 w-6 text-danger" />;
      case "high":
        return <AlertTriangle className="h-6 w-6 text-warning" />;
      case "medium":
        return <AlertCircle className="h-6 w-6 text-warning" />;
      default:
        return <CheckCircle className="h-6 w-6 text-success" />;
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "critical":
        return "bg-danger-light border-danger/30";
      case "high":
        return "bg-warning-light border-warning/30";
      case "medium":
        return "bg-warning-light border-warning/30";
      default:
        return "bg-success-light border-success/30";
    }
  };

  const getRiskPercentageColor = (score: number) => {
    if (score >= 51) return "bg-danger";
    if (score >= 26) return "bg-warning";
    return "bg-success";
  };

  return (
    <AppShell>
      <PageHeader
        title="Проверка контрагентов"
        description="Узнайте риск-скор компании по ИНН на основе открытых данных."
      />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Search form */}
          <div className="mb-8">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Введите ИНН (10-12 цифр)"
                value={inn}
                onChange={(e) => setInn(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handleCheck()}
                maxLength={12}
                className="flex-1 rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <button
                onClick={handleCheck}
                disabled={loading}
                className={buttonClass()}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Проверить
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 rounded-lg bg-danger-light border border-danger/30 p-4 text-danger">
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Profile */}
          {profile && (
            <div className="space-y-6">
              {/* Risk score card */}
              <div
                className={`rounded-lg border p-6 ${getRiskColor(
                  profile.riskLevel
                )}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-foreground mb-1">
                      {profile.name}
                    </h2>
                    <p className="text-sm text-muted">ИНН: {profile.inn}</p>
                    {profile.dataSource && (
                      <p className="text-xs text-muted mt-1">
                        Источник:{" "}
                        <span
                          className={
                            profile.dataSource === "dadata"
                              ? "text-success font-medium"
                              : profile.dataSource === "egrul"
                                ? "text-primary font-medium"
                                : "text-warning font-medium"
                          }
                        >
                          {profile.dataSource === "dadata"
                            ? "DaData (реальные данные)"
                            : profile.dataSource === "egrul"
                              ? "ЕГРЮЛ"
                              : "Демо-данные"}
                        </span>
                      </p>
                    )}
                  </div>
                  {getRiskIcon(profile.riskLevel)}
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">
                      Риск-скор
                    </span>
                    <span className="text-2xl font-bold text-foreground">
                      {profile.riskScore}
                    </span>
                  </div>
                  <div className="w-full bg-card-hover rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${getRiskPercentageColor(
                        profile.riskScore
                      )}`}
                      style={{ width: `${profile.riskScore}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-muted">
                    <span>0 (низкий риск)</span>
                    <span>100 (критический)</span>
                  </div>
                </div>

                {/* Risk level badge */}
                <div className="inline-block">
                  {profile.riskLevel === "critical" && (
                    <Badge tone="danger">Критический риск</Badge>
                  )}
                  {profile.riskLevel === "high" && (
                    <Badge tone="danger">Высокий риск</Badge>
                  )}
                  {profile.riskLevel === "medium" && (
                    <Badge tone="warning">Средний риск</Badge>
                  )}
                  {profile.riskLevel === "low" && (
                    <Badge tone="success">Низкий риск</Badge>
                  )}
                </div>
              </div>

              {/* Company info */}
              <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  Информация о компании
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {profile.organizationType && (
                    <div>
                      <p className="text-sm text-muted mb-1">Тип организации</p>
                      <p className="text-foreground font-medium">
                        {profile.organizationType}
                      </p>
                    </div>
                  )}

                  {profile.statusCode && (
                    <div>
                      <p className="text-sm text-muted mb-1">Статус</p>
                      <p className="text-foreground font-medium">
                        {profile.statusCode}
                      </p>
                    </div>
                  )}

                  {profile.registrationDate && (
                    <div>
                      <p className="text-sm text-muted mb-1 flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Дата регистрации
                      </p>
                      <p className="text-foreground font-medium">
                        {new Date(profile.registrationDate).toLocaleDateString(
                          "ru-RU"
                        )}
                      </p>
                    </div>
                  )}

                  {profile.okved && (
                    <div>
                      <p className="text-sm text-muted mb-1">Вид деятельности</p>
                      <p className="text-foreground font-medium">
                        {profile.okved}
                      </p>
                    </div>
                  )}

                  {profile.address && (
                    <div className="sm:col-span-2">
                      <p className="text-sm text-muted mb-1 flex items-center gap-1">
                        <Building2 className="h-4 w-4" />
                        Адрес
                      </p>
                      <p className="text-foreground font-medium">
                        {profile.address}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Reach the counterparty directly when its ИНН belongs to
                  a Яксо account. */}
              <ContactCounterparty inn={profile.inn} />

              {/* Risk factors. Court / debt rows are gated until the real
                  KAD (api-fns.ru) and FSSP integrations are wired —
                  showing literal zeros from the stub providers gave users
                  a false sense of safety on counterparties that actually
                  had lawsuits or bailiff cases. ЕГРЮЛ-derived signals
                  stay visible. */}
              <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  Факторы риска
                </h3>

                <div className="space-y-3">
                  <div
                    role="status"
                    className="rounded-lg border border-warning/30 bg-warning-light/50 p-3 text-xs text-warning"
                  >
                    Проверка по арбитражным делам (КАД) и исполнительным
                    производствам (ФССП) скоро будет доступна. Сейчас
                    показываем только данные из ЕГРЮЛ и DaData.
                  </div>

                  {profile.riskFactors.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-muted mb-2">Выявленные риски:</p>
                      <div className="flex flex-wrap gap-2">
                        {profile.riskFactors.map((factor) => (
                          <span
                            key={factor}
                            className="inline-flex items-center gap-1 rounded-md border border-danger/25 bg-danger-light px-2 py-1 text-xs text-danger"
                          >
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                            {factor}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes section */}
              <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Ваши комментарии
                </h3>

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Добавьте свои заметки о контрагенте..."
                  rows={4}
                  className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />

                <button
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className={buttonClass({ size: "sm", className: "mt-3" })}
                >
                  {savingNotes ? "Сохранение..." : "Сохранить комментарий"}
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!profile && !loading && !error && (
            <div className="text-center py-12">
              <Building2 className="h-16 w-16 text-muted mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Готов к проверке
              </h3>
              <p className="text-muted">
                Введите ИНН контрагента, чтобы узнать его риск-скор
              </p>
            </div>
          )}
      </div>
    </AppShell>
  );
}
