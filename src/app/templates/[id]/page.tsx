"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CounterpartyFieldInput } from "@/components/counterparty-field-input";
import { useToast } from "@/components/toast";
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
  GitBranch,
} from "lucide-react";

export default function TemplateFillPageWrapper() {
  // useSearchParams requires Suspense in Next.js 16. Wrap so the page
  // can statically prerender the loading state without bailing.
  return (
    <Suspense
      fallback={
        <AppShell>
            <Loader2 className="h-8 w-8 animate-spin text-muted" />
          </AppShell>
      }
    >
      <TemplateFillPage />
    </Suspense>
  );
}

function TemplateFillPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const template = getTemplate(params.id as string);
  const templateId = params.id as string;

  // Edit mode: when ?editDoc={id} is in the URL, we're editing an
  // existing GeneratedDocument. The form gets prefilled from the
  // server's stored formData (NOT from localStorage — the cached
  // draft might be stale or belong to a different document) and the
  // submit path goes to /api/generated/{id}/create-version instead
  // of POST /api/generated, so we accumulate versions on the same
  // document instead of forking a parallel copy.
  const editDocId = searchParams.get("editDoc");
  const [editDocLoaded, setEditDocLoaded] = useState(!editDocId);

  const [formData, setFormData] = useState<Record<string, string>>(() => {
    if (editDocId) return {}; // Will be filled from API after load.
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`template_${templateId}`);
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Edit-mode bootstrap: fetch the existing document and use its
  // formData as the initial form values.
  useEffect(() => {
    if (!editDocId) return;
    let cancelled = false;
    fetch(`/api/generated/${editDocId}`)
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 401) {
          router.push("/login");
          return;
        }
        if (!r.ok) {
          toast.error("Не удалось загрузить документ для редактирования.");
          router.push("/dashboard");
          return;
        }
        const doc = await r.json();
        if (cancelled) return;
        if (
          doc.formData &&
          typeof doc.formData === "object" &&
          !Array.isArray(doc.formData)
        ) {
          // Coerce numbers/booleans back to strings for the form.
          const ff: Record<string, string> = {};
          for (const [k, v] of Object.entries(doc.formData)) {
            if (typeof v === "string") ff[k] = v;
            else if (v != null) ff[k] = String(v);
          }
          setFormData(ff);
        }
        setEditDocLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Не удалось загрузить документ для редактирования.");
          setEditDocLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [editDocId, router, toast]);

  // Don't autosave to localStorage when editing an existing doc — the
  // draft would clobber the cached "fresh template" draft for new
  // documents made from the same templateId.
  useEffect(() => {
    if (editDocId) return;
    if (typeof window !== "undefined" && Object.keys(formData).length > 0) {
      localStorage.setItem(`template_${templateId}`, JSON.stringify(formData));
    }
  }, [formData, templateId, editDocId]);

  if (!template) {
    return (
      <AppShell>
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
        </AppShell>
    );
  }

  const handleChange = (id: string, value: string) => {
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const isValid = template.fields
    .filter((f) => f.required)
    .every((f) => formData[f.id]?.trim());

  const handleGenerate = async () => {
    if (!template) return;
    setIsGenerating(true);

    // Render the document deterministically — pure string interpolation,
    // no AI tokens.
    const content = generateContract(template.id, formData);

    // Two paths: editing an existing doc (create-version) vs creating a
    // new one (POST /api/generated). Same payload shape both ways.
    const url = editDocId
      ? `/api/generated/${editDocId}/create-version`
      : "/api/generated";
    const payload = editDocId
      ? { content, formData, title: template.name }
      : { templateId: template.id, name: template.name, content, formData };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        // Anonymous user — only possible when creating a new doc; edit
        // mode requires login at the entry point. Show the document
        // but warn that it isn't saved.
        setGeneratedDoc(content);
        setIsGenerating(false);
        toast.info(
          "Документ готов. Чтобы сохранить и редактировать его дальше — войдите в аккаунт."
        );
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        return;
      }

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (json.code === "QUOTA_EXCEEDED") {
          setIsGenerating(false);
          toast.error(json.error ?? "Лимит генераций исчерпан.");
          return;
        }
        // Save failed for some other reason — still show the
        // generated text so the user can copy / download it manually.
        setGeneratedDoc(content);
        setIsGenerating(false);
        toast.error(
          json.error ?? "Документ создан, но не сохранён. Попробуйте ещё раз."
        );
        return;
      }

      // Success path — navigate to the (possibly newly created)
      // document. For edit mode, the doc id is stable; for new docs
      // we read it out of the response. Clear the localStorage draft
      // for new-doc mode only.
      const targetId: string = editDocId ?? json.id;
      if (!editDocId && typeof window !== "undefined") {
        localStorage.removeItem(`template_${templateId}`);
      }
      if (editDocId) {
        toast.success("Создана новая версия документа.");
      }
      router.push(`/generated/${targetId}`);
    } catch (e) {
      console.error("[generate] save failed:", e);
      setGeneratedDoc(content);
      setIsGenerating(false);
      toast.error(
        "Документ создан, но не сохранён — проверьте соединение."
      );
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

  // Live preview — generateContract is pure deterministic interpolation,
  // so re-deriving the document on every keystroke costs nothing.
  const livePreview = generateContract(template.id, formData);

  return (
    <AppShell>
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:max-w-6xl lg:px-8">
          {/* Back link */}
          <Link
            href="/templates"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Все шаблоны
          </Link>

          {!editDocLoaded ? (
            <div className="animate-fade-in flex flex-col items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-muted" />
              <p className="mt-3 text-sm text-muted">
                Загружаем документ для редактирования...
              </p>
            </div>
          ) : !generatedDoc ? (
            <div className="animate-in fade-in duration-300">
              {/* Template header */}
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-foreground">
                  {template.name}
                </h1>
                <p className="mt-2 text-muted">{template.description}</p>
              </div>

              {editDocId && (
                <div className="mb-6 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary-light/30 px-4 py-3 text-sm text-primary-dark">
                  <GitBranch className="h-4 w-4 shrink-0" />
                  <span>
                    Редактирование документа. После сохранения создастся
                    новая версия — старая останется в истории.
                  </span>
                </div>
              )}

              <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
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
                        {editDocId ? "Сохраняем версию..." : "Формируем документ..."}
                      </>
                    ) : (
                      <>
                        {editDocId ? (
                          <GitBranch className="h-4 w-4" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        {editDocId
                          ? "Сохранить как новую версию"
                          : "Сгенерировать документ"}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Live preview — updates on every keystroke (deterministic
                  generation). Side-by-side on lg, stacked below. */}
              <div className="mt-6 lg:mt-0 lg:sticky lg:top-20">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  Предпросмотр
                </p>
                <div className="document-page max-h-[72vh] overflow-y-auto rounded-lg">
                  <div className="document-preview p-6 sm:p-8">
                    <pre className="whitespace-pre-wrap break-words font-serif text-[12px] leading-6">
                      {livePreview}
                    </pre>
                  </div>
                </div>
              </div>
              </div>
            </div>
          ) : (
            /* Generated document */
            <div className="animate-in fade-in duration-500">
              {/* Success header */}
              <div className="mb-6 flex items-center gap-3 rounded-xl bg-success-light border border-success/30 p-4">
                <CheckCircle className="h-5 w-5 text-success shrink-0" />
                <div>
                  <p className="font-semibold text-success">
                    Документ успешно сгенерирован
                  </p>
                  <p className="text-sm text-success">
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
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
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

              {/* Document preview in A4 format. .document-page keeps the
                  paper literal-white in both themes with a soft theme-
                  aware shadow (no muddy halo on dark canvas). */}
              <div className="flex justify-center my-6">
                <div className="w-full max-w-2xl">
                  <div className="document-page rounded-lg overflow-hidden">
                    <div className="document-preview p-6 sm:p-10 lg:p-12">
                      <pre className="whitespace-pre-wrap font-serif text-[13px] leading-7 break-words">
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
                  className="rounded-xl border border-border bg-card px-6 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
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
      </AppShell>
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
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted/60 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
        />
      ) : field.type === "select" ? (
        <select
          value={formData[field.id] || ""}
          onChange={(e) => handleChange(field.id, e.target.value)}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted/60 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      )}
    </div>
  );
}
