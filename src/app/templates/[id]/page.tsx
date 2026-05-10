"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
import { CounterpartyFieldInput } from "@/components/counterparty-field-input";
import { getTemplate, type TemplateField } from "@/lib/templates";
import { generateContract } from "@/lib/contracts/templates";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  CheckCircle,
  Download,
  Copy,
  FileText,
} from "lucide-react";

export default function TemplateFillPage() {
  const params = useParams();
  const template = getTemplate(params.id as string);
  const templateId = params.id as string;

  const [formData, setFormData] = useState<Record<string, string>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`template_${templateId}`);
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && Object.keys(formData).length > 0) {
      localStorage.setItem(`template_${templateId}`, JSON.stringify(formData));
    }
  }, [formData, templateId]);

  if (!template) {
    return (
      <div className="flex min-h-full flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground">
              Шаблон не найден
            </h1>
            <Link
              href="/templates"
              className="mt-4 inline-flex text-sm text-primary hover:underline"
            >
              Вернуться к шаблонам
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const handleChange = (id: string, value: string) => {
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const isValid = template.fields
    .filter((f) => f.required)
    .every((f) => formData[f.id]?.trim());

  const handleGenerate = async () => {
    setIsGenerating(true);
    // Small artificial delay for smooth UX (transition feels more "real")
    await new Promise((r) => setTimeout(r, 600));
    const doc = generateContract(template.id, formData);
    setGeneratedDoc(doc);
    setIsGenerating(false);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleCopy = async () => {
    if (generatedDoc) {
      await navigator.clipboard.writeText(generatedDoc);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadDocx = async () => {
    if (!generatedDoc || !template) return;

    try {
      const response = await fetch("/api/export/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: template.name,
          content: generatedDoc,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${template.name || "document"}.docx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Error downloading document:", error);
      alert("Ошибка при скачивании документа");
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <Header />

      <main className="flex-1 bg-surface/30">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Back link */}
          <Link
            href="/templates"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Все шаблоны
          </Link>

          {!generatedDoc ? (
            <div className="animate-in fade-in duration-300">
              {/* Template header */}
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-foreground">
                  {template.name}
                </h1>
                <p className="mt-2 text-muted">{template.description}</p>
              </div>

              {/* Form */}
              <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
                {renderFormByGroups(template.fields, formData, handleChange)}

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={handleGenerate}
                    disabled={!isValid || isGenerating}
                    className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Формируем документ...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Сгенерировать документ
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Generated document */
            <div className="animate-in fade-in duration-500">
              {/* Success header */}
              <div className="mb-6 flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 p-4">
                <CheckCircle className="h-5 w-5 text-success shrink-0" />
                <div>
                  <p className="font-semibold text-green-800">
                    Документ успешно сгенерирован
                  </p>
                  <p className="text-sm text-green-700">
                    Проверьте содержание и скачайте готовый документ
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                  <FileText className="h-5 w-5 text-primary" />
                  {template.name}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-success" />
                        Скопировано
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Копировать
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleDownloadDocx}
                    className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
                  >
                    <Download className="h-4 w-4" />
                    Скачать DOCX
                  </button>
                </div>
              </div>

              {/* Document preview in A4 format */}
              <div className="flex justify-center my-6">
                <div className="w-full max-w-2xl">
                  <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
                    <div className="p-8 sm:p-12">
                      <pre className="whitespace-pre-wrap font-serif text-[13px] leading-7 text-foreground break-words">
                        {generatedDoc}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>

              {/* Generate another */}
              <div className="mt-6 flex justify-center gap-3">
                <button
                  onClick={() => setGeneratedDoc(null)}
                  className="rounded-xl border border-border bg-white px-6 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
                >
                  Редактировать данные
                </button>
                <Link
                  href="/templates"
                  className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
                >
                  Создать другой документ
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      <Disclaimer />
    </div>
  );
}

function renderFormByGroups(
  fields: TemplateField[],
  formData: Record<string, string>,
  handleChange: (id: string, value: string) => void
) {
  const groupLabels: Record<string, string> = {
    parties: "Стороны договора",
    conditions: "Условия",
    dates: "Сроки",
    payment: "Оплата",
    additional: "Дополнительно",
  };

  const groups = new Map<string, TemplateField[]>();
  const ungrouped: TemplateField[] = [];

  fields.forEach((field) => {
    const group = field.group || null;
    if (group) {
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(field);
    } else {
      ungrouped.push(field);
    }
  });

  return (
    <div className="space-y-6">
      {Array.from(groups.entries()).map(([groupKey, groupFields]) => (
        <div key={groupKey} className="space-y-4">
          <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">
            {groupLabels[groupKey] || groupKey}
          </h3>
          <div className="space-y-4 ml-2 border-l-2 border-primary/20 pl-4">
            {groupFields.map((field) => renderField(field, formData, handleChange))}
          </div>
        </div>
      ))}

      {ungrouped.length > 0 && (
        <div className="space-y-4">
          {ungrouped.map((field) => renderField(field, formData, handleChange))}
        </div>
      )}
    </div>
  );
}

function renderField(
  field: TemplateField,
  formData: Record<string, string>,
  handleChange: (id: string, value: string) => void
) {
  const isInnField = field.id.includes("Inn") || field.id.includes("inn");

  return (
    <div key={field.id}>
      <label className="mb-1.5 block text-sm font-medium text-foreground">
        {field.label}
        {field.required && <span className="ml-1 text-danger">*</span>}
      </label>

      {field.type === "textarea" ? (
        <textarea
          value={formData[field.id] || ""}
          onChange={(e) => handleChange(field.id, e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted/60 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
        />
      ) : field.type === "select" ? (
        <select
          value={formData[field.id] || ""}
          onChange={(e) => handleChange(field.id, e.target.value)}
          className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Выберите...</option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : isInnField ? (
        <CounterpartyFieldInput
          value={formData[field.id] || ""}
          onChange={(value) => handleChange(field.id, value)}
          placeholder={field.placeholder}
        />
      ) : (
        <input
          type={field.type}
          value={formData[field.id] || ""}
          onChange={(e) => handleChange(field.id, e.target.value)}
          placeholder={field.placeholder}
          className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted/60 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      )}
    </div>
  );
}
