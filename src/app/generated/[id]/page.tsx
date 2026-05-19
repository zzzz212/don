"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { useToast } from "@/components/toast";
import { RefinePanel } from "@/components/refine-panel";
import { InlineEdit } from "@/components/inline-edit";
import { SendToChat } from "@/components/send-to-chat";
import { getTemplate } from "@/lib/templates";
import {
  Download,
  Copy,
  FileText,
  Loader2,
  Trash2,
  CheckCircle,
  GitBranch,
  Pencil,
} from "lucide-react";

interface GeneratedDocument {
  id: string;
  templateId: string;
  name: string;
  content: string;
  formData: Record<string, string>;
  createdAt: string;
}

/**
 * Render the generated contract text with paragraph-aware typography.
 * Generated documents use plain text with blank-line paragraph breaks
 * and section headings written in ALL CAPS or beginning with a digit
 * + dot. Detect the obvious cases so the preview reads like a real
 * legal document instead of a monospaced wall of text.
 */
function renderDocumentParagraphs(content: string): React.ReactNode {
  const blocks = content.split(/\n\s*\n/);
  return blocks.map((rawBlock, i) => {
    const block = rawBlock.trim();
    if (!block) return null;

    const isAllCapsHeading =
      block.length > 1 &&
      block.length < 100 &&
      block === block.toUpperCase() &&
      /[А-ЯA-Z]/.test(block);
    const isNumberedSection = /^\d+\.\s+[А-ЯA-Z]/.test(block);

    // No `text-foreground` here — that class binds to the theme variable
    // and would render light grey on the always-white document page in
    // dark mode. We let the .document-preview parent's CSS color cascade
    // through (see globals.css — it pins all descendants to ink black).
    if (isAllCapsHeading) {
      return (
        <h2
          key={i}
          className="mb-3 mt-6 text-center text-base font-bold uppercase tracking-wide first:mt-0"
        >
          {block}
        </h2>
      );
    }
    if (isNumberedSection) {
      // Show first line as a section heading, rest as a justified paragraph.
      const [firstLine, ...rest] = block.split("\n");
      return (
        <div key={i} className="mb-4 mt-5 first:mt-0">
          <h3 className="mb-2 text-sm font-bold">{firstLine}</h3>
          {rest.length > 0 && (
            <p className="whitespace-pre-line text-justify text-sm leading-relaxed">
              {rest.join("\n")}
            </p>
          )}
        </div>
      );
    }
    return (
      <p
        key={i}
        className="mb-3 whitespace-pre-line text-justify text-sm leading-relaxed"
      >
        {block}
      </p>
    );
  });
}

export default function ViewGeneratedPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const [doc, setDoc] = useState<GeneratedDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [versionCount, setVersionCount] = useState<number | null>(null);

  const docId = params.id as string;
  const template = doc ? getTemplate(doc.templateId) : null;

  useEffect(() => {
    async function loadDocument() {
      try {
        const [docResp, versionsResp] = await Promise.all([
          fetch(`/api/generated/${docId}`),
          fetch(`/api/generated/${docId}/versions`),
        ]);
        if (docResp.ok) {
          const data = await docResp.json();
          setDoc(data);
        } else if (docResp.status === 401) {
          router.push("/login");
        }
        if (versionsResp.ok) {
          const v = await versionsResp.json();
          setVersionCount(Array.isArray(v.versions) ? v.versions.length : 0);
        }
      } catch (error) {
        console.error("Error loading document:", error);
      } finally {
        setLoading(false);
      }
    }
    loadDocument();
  }, [docId, router]);

  const handleCopy = async () => {
    if (doc) {
      await navigator.clipboard.writeText(doc.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = async () => {
    if (!doc) return;

    try {
      const response = await fetch("/api/export/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: doc.name,
          content: doc.content,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${doc.name || "document"}.docx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Error downloading document:", error);
      toast.error("Не удалось скачать DOCX. Попробуйте ещё раз.");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Вы уверены? Документ будет удален.")) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/generated/${docId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Документ удалён");
        router.push("/dashboard");
      } else {
        toast.error("Не удалось удалить документ");
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Не удалось удалить документ. Проверьте соединение.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </AppShell>
    );
  }

  if (!doc) {
    return (
      <AppShell>
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground">
              Документ не найден
            </h1>
            <Link
              href="/dashboard"
              className="mt-4 inline-flex text-sm text-primary hover:underline"
            >
              Вернуться на дашборд
            </Link>
          </div>
        </AppShell>
    );
  }

  return (
    <AppShell>
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Document info */}
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-primary-light border border-primary/30 p-4">
            <CheckCircle className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="font-semibold text-primary-dark">Документ загружен</p>
              <p className="text-sm text-primary-dark">
                Дата создания:{" "}
                {new Date(doc.createdAt).toLocaleDateString("ru-RU", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          {/* Header with actions */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="flex items-center gap-2">
                <FileText className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
                <InlineEdit
                  value={doc.name}
                  variant="h1"
                  editLabel="Переименовать документ"
                  minLength={1}
                  maxLength={200}
                  onSave={async (next) => {
                    const r = await fetch(`/api/generated/${doc.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: next }),
                    });
                    const j = await r.json().catch(() => ({}));
                    if (!r.ok) {
                      throw new Error(j.error ?? "Не удалось переименовать");
                    }
                    setDoc((prev) => (prev ? { ...prev, name: j.name ?? next } : prev));
                    toast.success("Название обновлено");
                  }}
                />
              </h1>
              {versionCount !== null && versionCount > 0 && (
                <span className="rounded-md bg-primary-light px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-primary-dark">
                  {`Версия ${versionCount}`}
                </span>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
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
                onClick={handleDownload}
                className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
              >
                <Download className="h-4 w-4" />
                Скачать DOCX
              </button>
              <SendToChat documentId={doc.id} documentName={doc.name} />
              <Link
                href={`/generated/${doc.id}/versions`}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
              >
                <GitBranch className="h-4 w-4" />
                Версии
                {versionCount !== null && versionCount > 0 && (
                  <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-muted">
                    {versionCount}
                  </span>
                )}
              </Link>
              <Link
                href={`/templates/${doc.templateId}?editDoc=${doc.id}`}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
              >
                <Pencil className="h-4 w-4" />
                Изменить
              </Link>
              <RefinePanel
                documentId={doc.id}
                currentContent={doc.content}
                onSaved={() => {
                  // Full reload — refreshes the version count chip,
                  // the document content, the dashboard sidebar, and
                  // the new entry in the version history all at once.
                  window.location.reload();
                }}
              />
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger-light disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Удалить
              </button>
            </div>
          </div>

          {/* Document preview — A4 page chrome with proper typography.
              Uses .document-page (always-white, theme-aware shadow) so the
              page sits cleanly on a dark canvas without a muddy halo. */}
          <div className="my-6 flex justify-center">
            <div className="w-full max-w-2xl rounded-lg document-page">
              <div className="document-preview p-6 sm:p-10 lg:p-14">
                {renderDocumentParagraphs(doc.content)}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/templates"
              className="rounded-xl border border-border bg-card px-6 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
            >
              Создать новый
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              На дашборд
            </Link>
          </div>
        </div>
      </AppShell>
  );
}
