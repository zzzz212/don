"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
import { getTemplate } from "@/lib/templates";
import {
  ArrowLeft,
  Download,
  Copy,
  FileText,
  Loader2,
  Trash2,
  CheckCircle,
  GitBranch,
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

    if (isAllCapsHeading) {
      return (
        <h2
          key={i}
          className="mb-3 mt-6 text-center text-base font-bold uppercase tracking-wide text-foreground first:mt-0"
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
          <h3 className="mb-2 text-sm font-bold text-foreground">{firstLine}</h3>
          {rest.length > 0 && (
            <p className="whitespace-pre-line text-justify text-sm leading-relaxed text-foreground">
              {rest.join("\n")}
            </p>
          )}
        </div>
      );
    }
    return (
      <p
        key={i}
        className="mb-3 whitespace-pre-line text-justify text-sm leading-relaxed text-foreground"
      >
        {block}
      </p>
    );
  });
}

export default function ViewGeneratedPage() {
  const params = useParams();
  const router = useRouter();
  const [doc, setDoc] = useState<GeneratedDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const docId = params.id as string;
  const template = doc ? getTemplate(doc.templateId) : null;

  useEffect(() => {
    async function loadDocument() {
      try {
        const response = await fetch(`/api/generated/${docId}`);
        if (response.ok) {
          const data = await response.json();
          setDoc(data);
        } else if (response.status === 401) {
          router.push("/login");
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
      alert("Ошибка при скачивании документа");
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
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      alert("Ошибка при удалении документа");
    } finally {
      setDeleting(false);
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

  if (!doc) {
    return (
      <div className="flex min-h-full flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
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
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <Header />

      <main className="flex-1 bg-surface/30">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Back link */}
          <Link
            href="/dashboard"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            На дашборд
          </Link>

          {/* Document info */}
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-blue-50 border border-blue-200 p-4">
            <CheckCircle className="h-5 w-5 text-blue-600 shrink-0" />
            <div>
              <p className="font-semibold text-blue-800">Документ загружен</p>
              <p className="text-sm text-blue-700">
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
          <div className="mb-4 flex items-center justify-between">
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <FileText className="h-6 w-6 text-primary" />
              {doc.name}
            </h1>
            <div className="flex gap-2 flex-wrap">
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
                onClick={handleDownload}
                className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
              >
                <Download className="h-4 w-4" />
                Скачать DOCX
              </button>
              <Link
                href={`/generated/${doc.id}/versions`}
                className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
              >
                <GitBranch className="h-4 w-4" />
                Версии
              </Link>
              <button
                onClick={() => {
                  localStorage.setItem(
                    `template_${doc.templateId}`,
                    JSON.stringify(doc.formData)
                  );
                  router.push(`/templates/${doc.templateId}`);
                }}
                className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
              >
                ✏️ Редактировать поля
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Удалить
              </button>
            </div>
          </div>

          {/* Document preview — A4 page chrome with proper typography. */}
          <div className="my-6 flex justify-center">
            <div className="w-full max-w-2xl rounded-lg bg-white shadow-2xl">
              <div className="document-preview p-10 sm:p-12 lg:p-14">
                {renderDocumentParagraphs(doc.content)}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/templates"
              className="rounded-xl border border-border bg-white px-6 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
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
      </main>

      <Disclaimer />
    </div>
  );
}
