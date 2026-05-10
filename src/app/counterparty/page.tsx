"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
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
    if (score >= 76) return "bg-red-600";
    if (score >= 51) return "bg-orange-600";
    if (score >= 26) return "bg-yellow-600";
    return "bg-green-600";
  };

  return (
    <div className="flex min-h-full flex-col">
      <Header />

      <main id="main-content" className="flex-1 bg-surface/30">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Проверка контрагентов
            </h1>
            <p className="text-muted">
              Узнайте риск-скор компании по ИНН на основе открытых данных
            </p>
          </div>

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
                className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50 flex items-center gap-2"
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
                    <h2 className="text-2xl font-bold text-foreground mb-1">
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
                    <span className="inline-block px-3 py-1 rounded-full bg-red-600 text-white text-xs font-semibold">
                      🔴 КРИТИЧЕСКИЙ РИСК
                    </span>
                  )}
                  {profile.riskLevel === "high" && (
                    <span className="inline-block px-3 py-1 rounded-full bg-orange-600 text-white text-xs font-semibold">
                      🟠 ВЫСОКИЙ РИСК
                    </span>
                  )}
                  {profile.riskLevel === "medium" && (
                    <span className="inline-block px-3 py-1 rounded-full bg-yellow-600 text-white text-xs font-semibold">
                      🟡 СРЕДНИЙ РИСК
                    </span>
                  )}
                  {profile.riskLevel === "low" && (
                    <span className="inline-block px-3 py-1 rounded-full bg-green-600 text-white text-xs font-semibold">
                      🟢 НИЗКИЙ РИСК
                    </span>
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

              {/* Risk factors */}
              <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  Факторы риска
                </h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-surface">
                    <span className="text-sm font-medium">
                      Активные судебные дела
                    </span>
                    <span className="font-bold text-lg">
                      {profile.activeLawsuits}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-surface">
                    <span className="text-sm font-medium">
                      Закрытые судебные дела
                    </span>
                    <span className="font-bold text-lg">
                      {profile.completedLawsuits}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-surface">
                    <span className="text-sm font-medium">Проигранные дела</span>
                    <span className="font-bold text-lg">{profile.lossesCount}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-surface">
                    <span className="text-sm font-medium">Наличие долгов</span>
                    <span className="font-bold">
                      {profile.debtFound ? "❌ Да" : "✅ Нет"}
                    </span>
                  </div>

                  {profile.riskFactors.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-muted mb-2">Выявленные риски:</p>
                      <div className="flex flex-wrap gap-2">
                        {profile.riskFactors.map((factor) => (
                          <span
                            key={factor}
                            className="inline-block px-2 py-1 rounded-full bg-danger-light text-danger text-xs"
                          >
                            ⚠️ {factor}
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
                  className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
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
      </main>

      <Disclaimer />
    </div>
  );
}
