"use client";

import Link from "next/link";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
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
  FilePlus,
  ClipboardCheck,
  FileCheck,
  Receipt,
  Scissors,
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
};

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  "Конфиденциальность": { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  "Недвижимость": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  "Торговля": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "Финансы": { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  "Услуги": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "Кадры": { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  "Документооборот": { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" },
};

export default function TemplatesPage() {
  return (
    <div className="flex min-h-full flex-col">
      <Header />

      <main className="flex-1 bg-surface/30">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light">
              <FolderOpen className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
              Шаблоны документов
            </h1>
            <p className="mt-2 text-muted max-w-lg mx-auto">
              Выберите тип документа, заполните форму — AI сгенерирует готовый
              юридический документ за пару минут
            </p>
          </div>

          {/* Templates grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template, i) => {
              const Icon = iconMap[template.icon] || Shield;
              const colors = categoryColors[template.category] || categoryColors["Конфиденциальность"];

              return (
                <Link
                  key={template.id}
                  href={`/templates/${template.id}`}
                  className="animate-slide-up group flex flex-col rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg"
                  style={{ animationDelay: `${i * 0.08}s`, opacity: 0 }}
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colors.bg}`}>
                      <Icon className={`h-6 w-6 ${colors.text}`} />
                    </div>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text} ${colors.border}`}>
                      {template.category}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
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
      </main>

      <Disclaimer />
    </div>
  );
}
