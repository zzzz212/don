import Link from "next/link";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
import {
  FileSearch,
  CheckCircle,
  ArrowRight,
  FileText,
  Scale,
  ScrollText,
  ChevronDown,
} from "lucide-react";

// Three concrete capabilities, not "AI does everything" handwave. The
// third card got rewritten from "Юридический скоринг" (which is just
// part of analysis, not a separate feature) to "Сравнение версий" —
// it's actually a distinct piece of the product and a real workflow
// для юристов и менеджеров.
const features = [
  {
    icon: FileSearch,
    title: "Аудит договоров",
    description:
      "Загрузите PDF или DOCX — модель находит несоразмерные штрафы, кабальные условия, пропущенные существенные пункты. Каждое замечание со ссылкой на статью ГК РФ.",
    href: "/analyze",
  },
  {
    icon: FileText,
    title: "Шаблоны под право РФ",
    description:
      "20 типов договоров — NDA, аренда, услуги, поставка, подряд, трудовой. Все формулировки соответствуют статьям ГК РФ и ТК РФ. После генерации — точечная AI-доработка под ваш кейс.",
    href: "/templates",
  },
  {
    icon: ScrollText,
    title: "История и сравнение версий",
    description:
      "Каждая правка договора сохраняется. Версии сравниваются построчно с подсветкой изменений. Откат на любую предыдущую редакцию — одним кликом.",
    href: "/templates",
  },
];

// Stats grounded in things we can actually point at — every number is
// defensible to a sceptical visitor. No "99% точность", no "10 000
// довольных клиентов" while we're still pre-launch.
const stats = [
  { value: "30–60 сек", label: "Время анализа договора средней длины" },
  { value: "60+", label: "Статей ГК / ППВС в справочнике модели" },
  { value: "20", label: "Готовых шаблонов договоров" },
  { value: "Сонэт 4.6", label: "Модель Claude для платных тарифов" },
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

      {/* Hero. Deliberately understated — the "нового поколения" badge
          was the giveaway that the page was AI-marketing-fluff. Lead
          with what the product actually does, in legalese a senior
          юрист would recognise as competent. */}
      <section className="relative overflow-hidden bg-hero-gradient py-20 lg:py-28">
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="animate-fade-in mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
              <Scale className="h-3.5 w-3.5" aria-hidden="true" />
              Договорное право РФ · ГК · ППВС
            </div>
            <h1 className="animate-fade-in stagger-1 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Аудит договоров.{" "}
              <span className="text-primary">
                Со ссылками на закон.
              </span>
            </h1>
            <p className="animate-fade-in stagger-2 mt-6 text-lg text-muted sm:text-xl max-w-2xl mx-auto leading-relaxed">
              Загрузите PDF или DOCX. Модель пройдёт по договору со справочником
              из 60+ статей ГК РФ и постановлений Пленумов ВС — отдельно
              отметит несоразмерные штрафы, кабальные условия, пропущенные
              существенные пункты. Каждый риск с цитатой и готовой правкой.
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
            <p className="animate-fade-in stagger-4 mt-6 text-xs text-muted">
              10 анализов в месяц бесплатно. Без привязки карты.{" "}
              <Link
                href="/sample-report"
                className="font-semibold text-primary hover:underline"
              >
                Посмотреть пример отчёта →
              </Link>
            </p>
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

      {/* How it works. Each step describes what specifically happens —
          file format, the model and reference base, the structure of
          the output. No "AI does its magic" black-box step. */}
      <section className="bg-surface/50 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Как это работает
            </h2>
            <p className="mt-4 text-lg text-muted">
              Без чёрного ящика. Конкретные шаги — конкретный результат.
            </p>
          </div>
          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            {[
              {
                step: "1",
                title: "Загрузите файл",
                description:
                  "PDF или DOCX до 30 страниц. Если PDF скан — подключается Yandex OCR (на платных тарифах). Текст и метаданные шифруются по TLS.",
              },
              {
                step: "2",
                title: "Модель проходит по договору",
                description:
                  "Claude Sonnet 4.6 (Opus 4.7 на «Бизнесе») сверяет каждый пункт со встроенным справочником из 60+ статей ГК РФ и Постановлений Пленумов ВС. Длинные договоры режутся на главы и обрабатываются параллельно с дедупликацией.",
              },
              {
                step: "3",
                title: "Структурированный отчёт",
                description:
                  "Уровень риска (низкий / средний / высокий), список замечаний с цитатой и точной статьёй, готовый юридический текст правки, чек-лист «что проверить до подписания». Применить правку — одна кнопка, экспорт в DOCX.",
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
                Модель и справочник
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                Claude Sonnet 4.6 / Opus 4.7. В системный промпт зашит
                справочник из 60+ статей ГК РФ и постановлений Пленумов
                ВС — модель цитирует статьи из этого списка, а не
                «вспоминает» номера. Меньше выдуманных ссылок,
                стабильное качество от запроса к запросу.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Калибровка под РФ
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                Промпт настроен на 11 кабальных конструкций из российской
                судебной практики: штраф за расторжение (ст. 333, 179, 450.1),
                односторонняя расторжка (ст. 450.1), безлимитная неустойка
                (ст. 333), отказ от ответственности за умысел (ст. 401, п. 4)
                и др. Каждый паттерн со статьёй.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Хранение и передача
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                Документы по TLS, метаданные в Neon Postgres. Инференс —
                на серверах Anthropic / Voyage в США; трансграничная
                передача явно фиксируется отдельным согласием по
                ст. 12 152-ФЗ при регистрации.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Чего сервис не делает
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                Не представляет в суде, не подаёт документы в Росреестр
                и Роспатент, не выстраивает налоговую структуру.
                Это к живому юристу. Мы — предсделочная диагностика,
                шаблоны и история правок. Отчёт носит информационный
                характер (ст. 779 ГК РФ).
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
              От 1 990 ₽/мес. Первые 10 анализов в месяц — бесплатно, без
              карты.
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

      {/* FAQ. Addresses the questions that show up in every B2B SaaS
          sales conversation: "AI это надёжно?", "А если ошибётся?",
          "Кто отвечает?", "Что с данными?". Skipping these is what
          makes a site read как лендинг типового AI-стартапа. */}
      <section id="faq" className="py-20 lg:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Частые вопросы
            </h2>
            <p className="mt-4 text-lg text-muted">
              Прямые ответы. Без маркетинговых формулировок.
            </p>
          </div>
          <div className="mt-12 space-y-3">
            {[
              {
                q: "AI может ошибиться. Кто несёт ответственность за решение подписать?",
                a: "Ответственность за подписание — на вас или вашем юристе. Наш отчёт — автоматическая оценка рисков, формально не является юридической консультацией (ст. 779 ГК РФ). Мы фиксируем это в дисклеймере под каждым отчётом и в публичной оферте. Для сделок с существенной ценой обязательно покажите отчёт живому юристу.",
              },
              {
                q: "Чем это отличается от ChatGPT, в который можно вставить договор?",
                a: "Тремя вещами. (1) Промпт калиброван под кабальные конструкции из российской судебной практики — 11 паттернов критичных нарушений, каждый со статьёй. (2) В системе зашит справочник из 60+ статей ГК и ППВС, модель сверяет с ним номера — реже выдумывает несуществующие пункты. (3) Структурированный JSON-вывод: одна кнопка применяет правку к договору и экспортирует чистый DOCX. ChatGPT даёт абзац текста; мы — готовый патч.",
              },
              {
                q: "Какие модели вы используете и где обрабатываются данные?",
                a: "Anthropic Claude Sonnet 4.6 на платных тарифах, Haiku 4.5 на бесплатном, Opus 4.7 на «Бизнесе» только для анализа. Серверы Anthropic — США. На странице регистрации вы даёте отдельное согласие на трансграничную передачу (ст. 12 152-ФЗ). Свои метаданные (логи, пользователи, аудит) храним в Neon Postgres (Россия / ЕС в зависимости от региона). Документы — Vercel Blob.",
              },
              {
                q: "Что делать с длинным договором (50+ страниц)?",
                a: "Договоры до 50 000 символов модель анализирует за один проход. Длиннее — режутся на главы, каждая обрабатывается параллельно, потом результаты сводятся с дедупликацией повторных рисков. На «Бизнесе» подключается Opus 4.7, который лучше держит контекст длинных документов.",
              },
              {
                q: "Какие документы поддерживаются?",
                a: "Любые договорные документы по праву РФ: купля-продажа, поставка, аренда, подряд, услуги, NDA, трудовые, агентский, заём, лицензионный и т.д. Не подходим для процессуальных документов (исковые, отзывы, апелляции), судебных стратегий, налоговых консультаций, регистрации интеллектуальной собственности.",
              },
              {
                q: "Можно ли использовать сгенерированные шаблоны без юриста?",
                a: "Для типовых сделок небольшого объёма — да, шаблоны рабочие и проходят формальные требования ГК РФ. Для сделок с существенной ценой (от ~500 тыс. руб.), уникальной структурой, иностранными контрагентами, ИС — лучше показать юристу. Мы экономим юристу 80% рутины, не заменяем его на сложных кейсах.",
              },
              {
                q: "Можно отказаться от подписки и забрать деньги?",
                a: "Подписка отменяется в личном кабинете в любой момент — доступ сохраняется до конца оплаченного периода. Возврат за неиспользованную часть — по правилам публичной оферты (ст. 32 Закона о защите прав потребителей). Возврат вычитает стоимость уже оказанных услуг (анализы, генерации) по тарифам разовой оплаты.",
              },
            ].map((item, i) => (
              <details
                key={i}
                className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-border-strong"
              >
                <summary className="flex cursor-pointer items-start justify-between gap-3 text-base font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                  <span>{item.q}</span>
                  <ChevronDown
                    className="mt-0.5 h-5 w-5 shrink-0 text-muted transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-primary to-blue-700 px-8 py-16 text-center text-white shadow-2xl shadow-primary/20 sm:px-16">
            <Scale className="mx-auto mb-4 h-10 w-10 opacity-80" />
            <h2 className="text-3xl font-bold sm:text-4xl">
              Загрузите договор — узнайте, что в нём не так
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-blue-100">
              PDF или DOCX. Отчёт со ссылками на ГК и готовыми правками.
              10 анализов в месяц бесплатно, без карты.
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
