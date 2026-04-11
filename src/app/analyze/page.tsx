"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
import { UploadZone } from "@/components/upload-zone";
import { FileSearch, Loader2, CheckCircle, Scale } from "lucide-react";

const stages = [
  "Извлекаем текст из документа...",
  "Анализируем структуру договора...",
  "Проверяем соответствие законодательству РФ...",
  "Оцениваем юридические риски...",
  "Формируем рекомендации...",
  "Готовим отчёт...",
];

export default function AnalyzePage() {
  const router = useRouter();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    setCurrentStage(0);

    // Simulate analysis stages
    for (let i = 0; i < stages.length; i++) {
      setCurrentStage(i);
      await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 600));
    }

    // Navigate to report page
    router.push("/report/demo");
  };

  return (
    <div className="flex min-h-full flex-col">
      <Header />

      <main className="flex-1 bg-surface/30">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          {!isAnalyzing ? (
            <div className="animate-fade-in">
              {/* Header */}
              <div className="mb-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light">
                  <FileSearch className="h-7 w-7 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">
                  Анализ договора
                </h1>
                <p className="mt-2 text-muted">
                  Загрузите договор — AI проверит каждый пункт и найдёт риски
                </p>
              </div>

              {/* Upload zone */}
              <UploadZone onFileSelect={handleFileSelect} />

              {/* Analyze button */}
              {selectedFile && (
                <div className="mt-6 animate-scale-in text-center">
                  <button
                    onClick={handleAnalyze}
                    className="group inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-dark hover:shadow-xl"
                  >
                    <Scale className="h-5 w-5" />
                    Начать анализ
                  </button>
                </div>
              )}

              {/* Info */}
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {[
                  { label: "Время анализа", value: "~30 секунд" },
                  { label: "Поддержка", value: "PDF, DOCX, TXT" },
                  { label: "Максимальный размер", value: "10 МБ" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-border bg-card p-4 text-center"
                  >
                    <p className="text-sm font-bold text-foreground">
                      {item.value}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Analysis in progress */
            <div className="animate-fade-in text-center py-16">
              <div className="relative mx-auto mb-8 h-24 w-24">
                <div className="absolute inset-0 rounded-full border-4 border-border" />
                <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Scale className="h-10 w-10 text-primary animate-pulse-ring" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-foreground">
                AI анализирует ваш договор
              </h2>
              <p className="mt-2 text-sm text-muted">
                Это займёт около 30 секунд
              </p>

              <div className="mx-auto mt-10 max-w-md">
                <div className="space-y-3 text-left">
                  {stages.map((stage, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 rounded-lg px-4 py-2.5 transition-all ${
                        i < currentStage
                          ? "bg-green-50 text-green-700"
                          : i === currentStage
                            ? "bg-primary-light text-primary-dark"
                            : "text-muted/50"
                      }`}
                    >
                      {i < currentStage ? (
                        <CheckCircle className="h-4 w-4 shrink-0 text-success" />
                      ) : i === currentStage ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                      ) : (
                        <div className="h-4 w-4 shrink-0 rounded-full border-2 border-current opacity-30" />
                      )}
                      <span className="text-sm font-medium">{stage}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Disclaimer />
    </div>
  );
}
