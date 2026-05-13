import Link from "next/link";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
import {
  Shield,
  FileSearch,
  Zap,
  CheckCircle,
  ArrowRight,
  FileText,
  Scale,
  Users,
} from "lucide-react";

const features = [
  {
    icon: FileSearch,
    title: "Анализ договоров",
    description:
      "Загрузите договор — AI найдёт опасные пункты, скрытые риски и предложит конкретные правки за 30 секунд.",
    href: "/analyze",
  },
  {
    icon: FileText,
    title: "Генерация документов",
    description:
      "Создавайте типовые документы — НДА, аренда, купля-продажа — заполнив простую форму. Юридически грамотно.",
    href: "/templates",
  },
  {
    icon: Shield,
    title: "Юридический скоринг",
    description:
      "Каждый договор получает оценку от 1 до 10. Вы сразу видите, безопасно ли подписывать.",
    href: "/analyze",
  },
];

// Stats are now grounded in things we can actually point at instead
// of vanity numbers ("99% точность" — измерено где?). Keep them honest:
// you can defend each value to a sceptical visitor.
const stats = [
  { value: "≈ 30 сек", label: "Среднее время анализа договора" },
  { value: "11", label: "Категорий критичных рисков по ГК РФ" },
  { value: "20+", label: "Шаблонов готовых договоров" },
  { value: "ГК РФ", label: "Каждое замечание — со ссылкой на статью" },
];

// Pricing tiles. Numbers and limits MUST match src/lib/legal-info.ts
// PRICING_RUB and src/lib/plans.ts PLAN_LIMITS — those are the source
// of truth for billing / quota; this landing block is a marketing
// mirror that gets edited alongside.
const pricing = [
  {
    name: "Старт",
    price: "0",
    period: "",
    description: "Для знакомства с сервисом",
    features: [
      "10 анализов договоров в месяц",
      "5 генераций документов",
      "Базовый отчёт о рисках",
    ],
    cta: "Начать бесплатно",
    href: "/register",
    popular: false,
  },
  {
    name: "Pro Solo",
    price: "1 990",
    period: "/ мес",
    description: "Для ИП и фрилансеров",
    features: [
      "100 анализов договоров в месяц",
      "Безлимитная генерация документов",
      "OCR для скан-PDF",
      "Векторный поиск по договорам",
      "Приоритетная поддержка",
    ],
    cta: "Подключить Pro Solo",
    href: "/billing",
    popular: true,
  },
  {
    name: "Pro Team",
    price: "4 990",
    period: "/ мес",
    description: "Для команд до 5 человек",
    features: [
      "Всё из Pro Solo",
      "До 5 участников",
      "500 анализов в месяц на команду",
      "Совместная история анализов",
    ],
    cta: "Подключить Pro Team",
    href: "/billing",
    popular: false,
  },
  {
    name: "Бизнес",
    price: "14 990",
    period: "/ мес",
    description: "Для компаний и юр.отделов",
    features: [
      "Всё из Pro Team",
      "Безлимитные анализы",
      "Анализ на модели Opus",
      "Расширенная история",
      "Персональный менеджер",
    ],
    cta: "Перейти на Бизнес",
    href: "/billing",
    popular: false,
  },
];

// Reviews intentionally removed from this file. The previous fake
// testimonials (Алексей К., Мария С., Дмитрий В.) hurt credibility:
// any visitor familiar with B2B landing pages spots invented quotes
// instantly. Reinstate this list only with real customers who agreed
// to be quoted by full name + company.

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden bg-hero-gradient py-20 lg:py-28">
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="animate-fade-in mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-light/50 px-4 py-1.5 text-sm font-medium text-primary-dark">
              <Zap className="h-4 w-4" />
              AI-юрист нового поколения
            </div>
            <h1 className="animate-fade-in stagger-1 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Проверь договор
              <span className="text-primary"> за 30 секунд</span>
            </h1>
            <p className="animate-fade-in stagger-2 mt-6 text-lg text-muted sm:text-xl max-w-2xl mx-auto leading-relaxed">
              Загрузите договор — искусственный интеллект найдёт опасные пункты,
              оценит риски и предложит правки. В 10 раз дешевле юриста.
            </p>
            <div className="animate-fade-in stagger-3 mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/analyze"
                className="group flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-dark hover:shadow-xl hover:shadow-primary/30"
              >
                Проверить договор бесплатно
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/templates"
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-8 py-3.5 text-base font-semibold text-foreground transition-colors hover:bg-surface"
              >
                <FileText className="h-4 w-4" />
                Создать документ
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border bg-card py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-bold text-primary">{stat.value}</p>
                <p className="mt-1 text-sm text-muted">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Всё, что нужно для юридической безопасности
            </h2>
            <p className="mt-4 text-lg text-muted">
              Один сервис заменяет рутинную работу юриста
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Link
                key={feature.title}
                href={feature.href}
                className="group rounded-2xl border border-border bg-card p-8 transition-all hover:border-primary/30 hover:shadow-lg"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                  <feature.icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {feature.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-surface/50 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Как это работает
            </h2>
            <p className="mt-4 text-lg text-muted">
              Три простых шага до полного анализа
            </p>
          </div>
          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            {[
              {
                step: "1",
                title: "Загрузите договор",
                description:
                  "Перетащите файл PDF или DOCX в окно загрузки. Поддерживаются любые типы договоров.",
              },
              {
                step: "2",
                title: "AI анализирует",
                description:
                  "Искусственный интеллект читает каждый пункт, сверяет с законодательством РФ и находит риски.",
              },
              {
                step: "3",
                title: "Получите отчёт",
                description:
                  "Подробный отчёт с оценкой, списком рисков и конкретными рекомендациями по каждому пункту.",
              },
            ].map((item) => (
              <div key={item.step} className="relative text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-white">
                  {item.step}
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What we actually do — replaces the fake-reviews section. Real
          testimonials get added back here once we have 5+ paying users
          who'd let us quote them with name + company. */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Как мы это делаем
            </h2>
            <p className="mt-4 text-lg text-muted">
              Без магии. Конкретный AI-конвейер под российское право.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Модель
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                Claude Sonnet 4.6 / Opus 4.7 для анализа. Промпт калиброван
                на 11 типичных кабальных условий из ГК РФ — штраф за
                расторжение, односторонняя расторжка, безлимитная неустойка
                и др.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Хранение
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                Документы загружаются по защищённому соединению, метаданные
                в Neon Postgres. Прозрачно указываем трансграничную передачу
                на странице «Конфиденциальность».
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Что AI находит
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                Несоразмерные штрафы (ст. 333 ГК), кабальные условия
                (ст. 179 ГК), односторонние изменения (ст. 450.1 ГК),
                отказ от ответственности за умысел (ст. 401 ГК), отсутствие
                существенных условий (ст. 432 ГК) — со ссылкой на статью.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Чего AI не заменит
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                Судебная стратегия, представительство, регистрация ИС —
                это к живому юристу. Мы — про быструю предсделочную
                диагностику и подготовку шаблонов. Ответ носит
                информационный характер.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-surface/50 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Простые тарифы
            </h2>
            <p className="mt-4 text-lg text-muted">
              В 10 раз дешевле юриста. Первые 10 анализов бесплатно.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {pricing.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border bg-card p-8 ${
                  plan.popular
                    ? "border-primary shadow-xl shadow-primary/10 ring-1 ring-primary"
                    : "border-border"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                    Популярный
                  </div>
                )}
                <div className="text-center">
                  <h3 className="text-lg font-bold text-foreground">
                    {plan.name}
                  </h3>
                  <p className="mt-1 text-sm text-muted">{plan.description}</p>
                  <div className="mt-4">
                    <span className="text-4xl font-extrabold text-foreground">
                      {plan.price === "0" ? "Бесплатно" : `${plan.price} ₽`}
                    </span>
                    {plan.period && (
                      <span className="text-muted">{plan.period}</span>
                    )}
                  </div>
                </div>
                <ul className="mt-8 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`mt-8 block w-full rounded-xl py-3 text-center text-sm font-semibold transition-colors ${
                    plan.popular
                      ? "bg-primary text-white hover:bg-primary-dark"
                      : "border border-border bg-card text-foreground hover:bg-surface"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-primary to-blue-700 px-8 py-16 text-center text-white shadow-2xl shadow-primary/20 sm:px-16">
            <Users className="mx-auto mb-4 h-10 w-10 opacity-80" />
            <h2 className="text-3xl font-bold sm:text-4xl">
              Проверить договор за 30 секунд
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-blue-100">
              Загрузите PDF или DOCX — получите заключение с цитатами из ГК РФ.
              Первые проверки бесплатно, без привязки карты.
            </p>
            <Link
              href="/analyze"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 font-semibold text-blue-700 transition-colors hover:bg-blue-50"
            >
              Загрузить договор
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <Disclaimer />
    </div>
  );
}
