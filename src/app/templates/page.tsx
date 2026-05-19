"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { templates } from "@/lib/templates";
import {
  FolderOpen,
  Shield,
  Building,
  Handshake,
  Briefcase,
  Users,
  Truck,
  Wallet,
  Hammer,
  ArrowRight,
  Clock,
  Sparkles,
  Search,
  FilePlus,
  ClipboardCheck,
  FileCheck,
  Receipt,
  Scissors,
  Gift,
  ArrowLeftRight,
  FileSignature,
  Store,
  Package,
  Warehouse,
} from "lucide-react";

const iconMap: Record<string, typeof Shield> = {
  shield: Shield,
  building: Building,
  handshake: Handshake,
  briefcase: Briefcase,
  users: Users,
  truck: Truck,
  wallet: Wallet,
  hammer: Hammer,
  "file-plus": FilePlus,
  "clipboard-check": ClipboardCheck,
  "file-check": FileCheck,
  receipt: Receipt,
  scissors: Scissors,
  gift: Gift,
  "arrow-left-right": ArrowLeftRight,
  "file-signature": FileSignature,
  store: Store,
  package: Package,
  warehouse: Warehouse,
};

// Category palette uses semantic tokens (theme-aware) where possible and
// raw Tailwind hues with explicit dark variants where the design needs
// distinct accents that don't map onto success/warning/primary.
const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  "Конфиденциальность": { bg: "bg-purple-50 dark:bg-purple-500/15", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-500/30" },
  "Недвижимость": { bg: "bg-primary-light", text: "text-primary-dark", border: "border-primary/30" },
  "Торговля": { bg: "bg-success-light", text: "text-success", border: "border-success/30" },
  "Финансы": { bg: "bg-indigo-50 dark:bg-indigo-500/15", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-500/30" },
  "Услуги": { bg: "bg-warning-light", text: "text-warning", border: "border-warning/30" },
  "Кадры": { bg: "bg-rose-50 dark:bg-rose-500/15", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200 dark:border-rose-500/30" },
  "Документооборот": { bg: "bg-surface", text: "text-foreground", border: "border-border" },
};

// Distinct categories, in first-seen order — drives the filter chips.
const CATEGORIES = Array.from(new Set(templates.map((t) => t.category)));

export default function TemplatesPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = templates.filter((t) => {
    if (category && t.category !== category) return false;
    if (q && !`${t.name} ${t.description}`.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });

  return (
    <AppShell>
      <PageHeader
        title="Шаблоны документов"
        description="Выберите тип документа, заполните форму — AI сгенерирует готовый юридический документ за пару минут."
      />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Search + category filter */}
          <div className="mb-8">
            <div className="relative mx-auto max-w-xl">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Найти шаблон — например, «аренда» или «NDA»"
                aria-label="Поиск по шаблонам"
                className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => setCategory(null)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  category === null
                    ? "bg-primary text-primary-fg"
                    : "border border-border bg-card text-muted hover:text-foreground"
                }`}
              >
                Все
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat === category ? null : cat)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    category === cat
                      ? "bg-primary text-primary-fg"
                      : "border border-border bg-card text-muted hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Templates grid */}
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center">
              <Search className="mx-auto mb-3 h-8 w-8 text-muted/50" />
              <p className="text-sm text-muted">
                Шаблонов по запросу не нашлось. Измените запрос или категорию.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((template, i) => {
                const Icon = iconMap[template.icon] || Shield;
                const colors =
                  categoryColors[template.category] ||
                  categoryColors["Конфиденциальность"];

                return (
                  <Link
                    key={template.id}
                    href={`/templates/${template.id}`}
                    className="animate-slide-up group flex flex-col rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg"
                    style={{ animationDelay: `${i * 0.05}s`, opacity: 0 }}
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colors.bg}`}>
                        <Icon className={`h-6 w-6 ${colors.text}`} />
                      </div>
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text} ${colors.border}`}>
                        {template.category}
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                      {template.name}
                    </h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                      {template.description}
                    </p>

                    <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-xs text-muted">
                          <Clock className="h-3 w-3" />
                          {template.estimatedTime}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted">
                          <Sparkles className="h-3 w-3" />
                          AI
                        </span>
                      </div>
                      <span className="flex items-center gap-1 text-sm font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                        Создать
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Coming soon */}
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
            <p className="text-sm font-semibold text-foreground">
              Скоро добавим ещё
            </p>
            <p className="mt-1 text-sm text-muted">
              Лицензионный договор, договор цессии, корпоративный договор,
              соглашение о задатке и другие
            </p>
          </div>
      </div>
    </AppShell>
  );
}
