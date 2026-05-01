"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface TemplateVariable {
  name: string;
  type: string;
  label: string;
  placeholder: string;
  required: boolean;
  hint?: string;
}

interface Template {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  variables: TemplateVariable[];
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Record<string, Template[]>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState<any>(null);
  const [error, setError] = useState<string>("");

  // Fetch templates on mount
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/templates/list");
      if (!res.ok) throw new Error("Failed to fetch templates");
      const data = await res.json();
      setTemplates(data.grouped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setFormData({});
    setGeneratedDoc(null);
    setError("");
    // Initialize form with empty values
    const initial: Record<string, string> = {};
    template.variables.forEach((v) => {
      initial[v.name] = "";
    });
    setFormData(initial);
  };

  const handleInputChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGenerate = async () => {
    if (!selectedTemplate) return;

    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateCode: selectedTemplate.code,
          variables: formData,
          documentName: `${selectedTemplate.name}`,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate document");
      }

      const data = await res.json();
      setGeneratedDoc(data.document);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !Object.keys(templates).length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
          <p className="mt-4 text-slate-600">Загрузка шаблонов...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-blue-600 hover:text-blue-700 mb-4 inline-block font-medium">
            ← На главную
          </Link>
          <h1 className="text-4xl font-bold text-slate-900">Шаблоны договоров</h1>
          <p className="text-slate-600 mt-2 text-lg">
            Выберите шаблон, заполните нужные данные и получите готовый документ
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 font-medium">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Templates List Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sticky top-8">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Шаблоны</h2>

              {Object.entries(templates).map(([category, cats]) => (
                <div key={category} className="mb-6">
                  <h3 className="text-xs font-bold uppercase text-slate-500 mb-2 px-2 tracking-wide">
                    {category}
                  </h3>
                  <div className="space-y-1">
                    {cats.map((template) => (
                      <button
                        key={template.code}
                        onClick={() => handleSelectTemplate(template)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          selectedTemplate?.code === template.code
                            ? "bg-blue-100 text-blue-900 border border-blue-300 shadow-sm"
                            : "hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        {template.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form and Preview */}
          <div className="lg:col-span-3">
            {selectedTemplate ? (
              <>
                {/* Template Form */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-slate-900">{selectedTemplate.name}</h2>
                    <p className="text-slate-600 mt-1">{selectedTemplate.description}</p>
                  </div>

                  {/* Form Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {selectedTemplate.variables.map((variable) => (
                      <div key={variable.name}>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          {variable.label}
                          {variable.required && <span className="text-red-600"> *</span>}
                        </label>
                        {variable.type === "date" ? (
                          <input
                            type="date"
                            value={formData[variable.name] || ""}
                            onChange={(e) =>
                              handleInputChange(variable.name, e.target.value)
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        ) : variable.type === "number" ? (
                          <input
                            type="number"
                            placeholder={variable.placeholder}
                            value={formData[variable.name] || ""}
                            onChange={(e) =>
                              handleInputChange(variable.name, e.target.value)
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        ) : (
                          <textarea
                            placeholder={variable.placeholder}
                            value={formData[variable.name] || ""}
                            onChange={(e) =>
                              handleInputChange(variable.name, e.target.value)
                            }
                            rows={variable.name.includes("DESCRIPTION") || variable.name.includes("SCOPE") ? 3 : 2}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          />
                        )}
                        {variable.hint && (
                          <p className="text-xs text-slate-500 mt-1">{variable.hint}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                  >
                    {loading ? "Генерируем документ..." : "✨ Сгенерировать документ"}
                  </button>
                </div>

                {/* Generated Document Preview */}
                {generatedDoc && (
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">
                      ✓ Документ готов!
                    </h3>
                    <div className="bg-slate-50 rounded-lg p-4 mb-4 max-h-96 overflow-y-auto border border-slate-200">
                      <div className="text-sm text-slate-800 whitespace-pre-wrap font-mono leading-relaxed">
                        {generatedDoc.content}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const element = document.createElement("a");
                          element.setAttribute(
                            "href",
                            "data:text/plain;charset=utf-8," +
                              encodeURIComponent(generatedDoc.content)
                          );
                          element.setAttribute(
                            "download",
                            `${selectedTemplate.name}.txt`
                          );
                          element.style.display = "none";
                          document.body.appendChild(element);
                          element.click();
                          document.body.removeChild(element);
                        }}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        ↓ Скачать TXT
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedDoc.content);
                          alert("Документ скопирован в буфер обмена!");
                        }}
                        className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        📋 Копировать
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        setGeneratedDoc(null);
                        setFormData({});
                      }}
                      className="w-full mt-3 border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      Создать ещё один документ
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
                <p className="text-slate-500 text-lg font-medium">
                  Выберите шаблон слева для начала работы
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
