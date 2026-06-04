import Link from "next/link";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
import { buttonClass } from "@/components/button";
import { DealRoomIllustration } from "@/components/deal-room-illustration";
import {
  ArrowRight,
  ChevronDown,
  Quote,
} from "lucide-react";

// Pricing tiles. Numbers and limits MUST stay in sync with
// src/lib/legal-info.ts PRICING_RUB and src/lib/plans.ts PLAN_LIMITS —
// those are the source of truth for billing / quota; this block is the
// marketing mirror, edited alongside.
const pricing = [
  {
    name: "Старт",
    price: "0",
    period: "",
    description: "Чтобы понять, как это работает",
    features: [
      "10 проверок договоров в месяц",
      "5 шаблонов документов",
      "Базовый отчёт о рисках",
    ],
    cta: "Начать без карты",
    href: "/register",
    accent: false,
  },
  {
    name: "Pro Solo",
    price: "1 990",
    period: "/ мес",
    description: "Для ИП и фрилансеров",
    features: [
      "100 проверок в месяц",
      "Безлимитная генерация документов",
      "OCR сканов и PDF",
      "Поиск по договорам",
      "Приоритетная поддержка",
    ],
    cta: "Подключить",
    href: "/billing",
    accent: true,
  },
  {
    name: "Pro Team",
    price: "4 990",
    period: "/ мес",
    description: "Командам до пяти",
    features: [
      "Всё из Pro Solo",
      "До 5 участников",
      "500 проверок на команду",
      "Общая история и обсуждения",
    ],
    cta: "Подключить",
    href: "/billing",
    accent: false,
  },
  {
    name: "Бизнес",
    price: "14 990",
    period: "/ мес",
    description: "Юр.отделам и корпорациям",
    features: [
      "Всё из Pro Team",
      "Безлимитные проверки",
      "Анализ на модели Opus",
      "Персональный менеджер",
    ],
    cta: "Подключить",
    href: "/billing",
    accent: false,
  },
];

// "Что мы ловим" — четыре категории, под которые откалиброван prompt.
// Не маркетинговый feature-dump, а конкретные конструкции с привязкой
// к статьям ГК РФ.
const categories = [
  {
    title: "Несоразмерные штрафы и неустойки",
    body:
      "Штраф 50% за расторжение, неустойка 1% в день, удержание аванса — суды снижают по ст. 333 ГК РФ. Но проще убрать до подписания.",
  },
  {
    title: "Кабальные условия",
    body:
      "Односторонний отказ исполнителя, безотзывные обязательства, отказ от ответственности за умысел — ст. 401 п. 4 ГК РФ делает такие пункты ничтожными.",
  },
  {
    title: "Пропущенные существенные условия",
    body:
      "Без предмета, цены, срока договор либо незаключён, либо толкуется не в вашу пользу. ст. 432 ГК РФ.",
  },
  {
    title: "Расхождения с практикой ВС РФ",
    body:
      "Постановления Пленумов и обзоров судебной практики за последние десять лет — внутри системного промпта. Если конструкция уже разбита в суде, отметим.",
  },
];

const steps = [
  {
    num: "01",
    title: "Загружаете файл",
    body:
      "PDF или DOCX до 30 страниц. Если PDF — скан, на платных тарифах подключается OCR. Текст идёт по TLS, оригинал — в Vercel Blob.",
  },
  {
    num: "02",
    title: "Модель проходит по договору",
    body:
      "Claude Sonnet 4.6 — на платных тарифах, Opus 4.7 — на «Бизнесе». Со встроенным справочником из 60+ статей ГК и Постановлений Пленумов ВС. Длинные документы режутся на главы и сводятся с дедупликацией.",
  },
  {
    num: "03",
    title: "Получаете отчёт",
    body:
      "Уровень риска, каждое замечание с цитатой и ссылкой на статью, готовая формулировка правки. Одна кнопка — DOCX с исправлениями.",
  },
];

const faq = [
  {
    q: "AI может ошибиться. Кто несёт ответственность за решение подписать?",
    a:
      "Ответственность за подписание — на вас или вашем юристе. Наш отчёт — автоматическая оценка рисков, формально не является юридической консультацией (ст. 779 ГК РФ). Для сделок с существенной ценой обязательно покажите отчёт живому юристу.",
  },
  {
    q: "Чем это отличается от ChatGPT, в который можно вставить договор?",
    a:
      "Тремя вещами. (1) Промпт калиброван под одиннадцать кабальных конструкций из российской судебной практики, каждая со статьёй. (2) В системе зашит справочник из 60+ статей ГК и ППВС — модель сверяет номера с ним, реже выдумывает несуществующие пункты. (3) Структурированный вывод: одна кнопка применяет правку и экспортирует чистый DOCX. ChatGPT даёт абзац текста — мы даём готовый патч.",
  },
  {
    q: "Какие модели вы используете и где обрабатываются данные?",
    a:
      "Anthropic Claude Sonnet 4.6 на платных тарифах, Haiku 4.5 на бесплатном, Opus 4.7 на «Бизнесе» в режиме анализа. Серверы Anthropic — США. При регистрации вы даёте отдельное согласие на трансграничную передачу по ст. 12 152-ФЗ. Свои метаданные (логи, пользователи, аудит) храним в Neon Postgres.",
  },
  {
    q: "Можно отказаться от подписки и забрать деньги?",
    a:
      "Подписка отменяется в личном кабинете в любой момент — доступ сохраняется до конца оплаченного периода. Возврат за неиспользованную часть — по правилам публичной оферты (ст. 32 ЗоЗПП), за вычетом стоимости уже оказанных услуг по тарифам разовой оплаты.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <Header />

      {/*
        Hero — split layout, copy on the left, a live sample report
        card on the right. The card is what makes the landing read as
        "I get it" instead of "I guess what they do". Pure markup,
        no real data — but keyed to the same example contract the
        /sample-report page renders, so the story is consistent.
      */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-hero-gradient"
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-7">
              <p className="animate-fade-in mb-6 text-sm font-medium uppercase tracking-[0.18em] text-muted">
                Яксо · Аудит договоров под право РФ
              </p>
              <h1 className="animate-fade-in stagger-1 font-serif text-4xl sm:text-5xl lg:text-[3.75rem] font-semibold tracking-tight text-foreground leading-[1.05]">
                Юрист, который читает{" "}
                <span className="italic text-primary">договор за вас.</span>
              </h1>
              <p className="animate-fade-in stagger-2 mt-7 max-w-xl text-lg lg:text-xl leading-relaxed text-foreground/75">
                Загрузите PDF или DOCX. Через минуту увидите, на что
                обратить внимание — со ссылками на ГК и готовыми
                формулировками правок.
              </p>
              <div className="animate-fade-in stagger-3 mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/analyze"
                  className={buttonClass({
                    variant: "primary",
                    size: "lg",
                    className: "group",
                  })}
                >
                  Проверить договор
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
                <Link
                  href="/sample-report"
                  className={buttonClass({ variant: "ghost", size: "lg" })}
                >
                  Посмотреть пример отчёта
                </Link>
              </div>
              <p className="animate-fade-in stagger-4 mt-5 text-sm text-muted">
                Бесплатно. Без карты. Первая проверка — за полминуты.
              </p>
            </div>

            {/* Live-feeling sample card. Static markup styled to mirror
                the real /report page so a visitor recognises the shape
                of the output before they upload. */}
            <div className="animate-fade-in stagger-2 lg:col-span-5">
              <SampleReportCard />
            </div>
          </div>
        </div>
      </section>

      {/*
        Что мы ловим — single-paragraph eyebrow, then a calm 2×2 of
        categories. No icons (they read as "AI feature dump") — just
        category title + a sentence each, with the GK reference baked
        into the body copy.
      */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
              На чём срываются договоры
            </p>
            <h2 className="mt-4 font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
              Что мы ловим
            </h2>
            <p className="mt-4 text-lg text-foreground/70 leading-relaxed">
              Четыре категории, под которые откалиброван промпт. Не
              «AI разбирает любой документ» — а конкретные конструкции,
              которые суды уже видели сотни раз.
            </p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2">
            {categories.map((c) => (
              <div
                key={c.title}
                className="rounded-2xl border border-border bg-card p-7 transition-colors hover:border-border-strong"
              >
                <h3 className="font-serif text-xl font-semibold text-foreground">
                  {c.title}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-foreground/70">
                  {c.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/*
        Deal Room band — Sprint 14 flagship gets a dedicated mention on
        the landing. Editorial split: copy on left, bespoke illustration
        on right. Sits between "Что мы ловим" and "Как это работает" —
        the natural place to say "and once you've found the risks, you
        can negotiate them right here".
      */}
      <section className="border-y border-rule py-20 lg:py-24">
        <div className="paper-grain mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
                Новинка · Deal Room
              </p>
              <h2 className="mt-4 font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
                Переговоры в одной комнате —{" "}
                <span className="italic text-primary">без переписки в WhatsApp</span>
                .
              </h2>
              <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-foreground/75">
                Отправляете контрагенту одну ссылку. Он открывает её без
                регистрации и e‑mail — видит ваш AI-разбор пункт за пунктом,
                принимает то, что устраивает, и оставляет правки на спорном.
                Когда оба согласовали — выгружаете финальный DOCX.
              </p>
              <ul className="mt-7 space-y-2.5 text-[15px] leading-relaxed text-foreground/80">
                <li className="flex gap-3">
                  <span aria-hidden className="mt-2 inline-block h-px w-4 bg-primary shrink-0" />
                  <span>
                    <strong className="font-semibold text-foreground">
                      Получатель без логина —
                    </strong>{" "}
                    кликнул ссылку, сразу видит разбор и кнопки «согласен / не согласен / комментарий».
                  </span>
                </li>
                <li className="flex gap-3">
                  <span aria-hidden className="mt-2 inline-block h-px w-4 bg-accent shrink-0" />
                  <span>
                    <strong className="font-semibold text-foreground">
                      Counter-AI —
                    </strong>{" "}
                    AI показывает обе стороны: что выгодно вам и что выгодно
                    им. Предлагает компромисс там, где это возможно.
                  </span>
                </li>
              </ul>
            </div>
            <div className="text-foreground" aria-hidden="true">
              <DealRoomIllustration className="h-auto w-full max-w-md mx-auto" />
            </div>
          </div>
        </div>
      </section>

      {/*
        Как это работает — three steps on warm surface band. Numbers are
        big serif, not pill-buttons (which read как любой step-by-step
        SaaS). Each step describes the concrete thing the system does.
      */}
      <section className="bg-surface py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
              Без чёрного ящика
            </p>
            <h2 className="mt-4 font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
              Никакой магии. Тридцать секунд от файла до отчёта.
            </h2>
          </div>
          <div className="mt-14 grid gap-10 lg:grid-cols-3 lg:gap-12">
            {steps.map((s) => (
              <div key={s.num} className="relative">
                <div className="font-serif text-5xl font-semibold tracking-tight text-primary/30 leading-none">
                  {s.num}
                </div>
                <h3 className="mt-4 font-serif text-xl font-semibold text-foreground">
                  {s.title}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-foreground/70">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/*
        Pricing. Same four tiers, but visual hierarchy via the accent
        ring on Pro Solo (the recommended one) instead of a "Популярный"
        badge — feels less salesy, reads as "this is the one we'd pick
        for you".
      */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
              Тариф
            </p>
            <h2 className="mt-4 font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
              Одна цена за то, что заменяет час юриста.
            </h2>
            <p className="mt-4 text-lg text-foreground/70 leading-relaxed">
              Если меньше или больше — есть варианты. Но восемь
              из десяти работают на Pro Solo.
            </p>
          </div>
          <div className="mt-14 grid gap-4 lg:grid-cols-4">
            {pricing.map((plan) => (
              <div
                key={plan.name}
                className={
                  plan.accent
                    ? "relative rounded-2xl border-2 border-primary bg-card p-7 shadow-md"
                    : "relative rounded-2xl border border-border bg-card p-7"
                }
              >
                {plan.accent && (
                  <div className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-fg">
                    Рекомендуем
                  </div>
                )}
                <h3 className="font-serif text-lg font-semibold text-foreground">
                  {plan.name}
                </h3>
                <p className="mt-1 text-sm text-muted">{plan.description}</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="font-serif text-3xl font-semibold text-foreground">
                    {plan.price === "0" ? "Бесплатно" : `${plan.price} ₽`}
                  </span>
                  {plan.period && (
                    <span className="text-sm text-muted">{plan.period}</span>
                  )}
                </div>
                <ul className="mt-6 space-y-2.5">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-[13px] leading-relaxed text-foreground/80"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-primary"
                      />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={buttonClass({
                    variant: plan.accent ? "primary" : "secondary",
                    className: "mt-7 w-full",
                  })}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/*
        FAQ — kept on the warm surface band. Four questions only; the
        long form lives on /help. These four are the ones every B2B sales
        conversation surfaces in the first ten minutes.
      */}
      <section className="bg-surface py-20 lg:py-28" id="faq">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
              Что обычно спрашивают
            </p>
            <h2 className="mt-4 font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
              Частые вопросы
            </h2>
          </div>
          <div className="mt-12 space-y-3">
            {faq.map((item, i) => (
              <details
                key={i}
                className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-border-strong"
              >
                <summary className="flex cursor-pointer items-start justify-between gap-4 font-serif text-lg font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                  <span>{item.q}</span>
                  <ChevronDown
                    className="mt-1 h-5 w-5 shrink-0 text-muted transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <p className="mt-4 text-[15px] leading-relaxed text-foreground/75">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-muted">
            Полный список —{" "}
            <Link
              href="/help"
              className="font-semibold text-primary hover:underline"
            >
              в справочнике →
            </Link>
          </p>
        </div>
      </section>

      {/*
        Final CTA — warm dark band on cream. The whole landing's been
        deliberately quiet so this single dark slab carries weight as
        the ask. Cream button on warm ink — the strongest contrast
        ratio in the design system.
      */}
      <section className="py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-foreground px-8 py-16 text-center sm:px-16 lg:py-20">
            <Quote
              aria-hidden="true"
              className="mx-auto h-8 w-8 text-background/40"
            />
            <h2 className="mt-5 font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-background leading-tight">
              Договор у вас уже открыт?
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-background/70">
              Загрузите — через минуту увидите, что в нём стоит обсудить
              с контрагентом до подписания.
            </p>
            <div className="mt-9">
              <Link
                href="/analyze"
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-background px-7 text-base font-semibold text-foreground transition-colors hover:bg-card"
              >
                Проверить договор
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <p className="mt-5 text-sm text-background/55">
              Десять проверок в месяц — бесплатно.
            </p>
          </div>
        </div>
      </section>

      <Disclaimer />
    </div>
  );
}

// The hero's right-column "live report" illustration. Hand-curated to
// mirror what /sample-report renders — same example contract type
// (IT-services), same 3 risks. Updating one without the other will
// quietly drift the story; keep them aligned.
function SampleReportCard() {
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-xl lg:p-7">
      <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Договор оказания услуг
          </p>
          <p className="mt-1 truncate font-serif text-base font-semibold text-foreground">
            IT-разработка, 12 страниц
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-danger-light px-3 py-1 text-xs font-semibold text-danger">
          Высокий риск
        </span>
      </div>

      <div className="mt-5 space-y-3">
        <SampleRisk
          tone="critical"
          title="Штраф 50% при расторжении заказчиком"
          quote="…при досрочном расторжении заказчик уплачивает штраф в размере 50% от стоимости договора…"
          reference="ст. 333, 450.1 ГК РФ"
          note="Суды признают такие штрафы кабальными — снижают по ст. 333."
        />
        <SampleRisk
          tone="medium"
          title="Срок оплаты услуг не определён"
          reference="ст. 314 ГК РФ"
          note="Без срока — «в разумный срок», что трудно доказать."
        />
        <SampleRisk
          tone="medium"
          title="Односторонняя правка тарифов исполнителем"
          reference="ст. 450.1, п. 2 ГК РФ"
        />
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
        <Link
          href="/sample-report"
          className="text-sm font-semibold text-primary hover:underline"
        >
          Открыть полный отчёт →
        </Link>
        <span className="text-xs text-muted">Анализ занял 47 сек</span>
      </div>
    </div>
  );
}

function SampleRisk({
  tone,
  title,
  quote,
  reference,
  note,
}: {
  tone: "critical" | "medium";
  title: string;
  quote?: string;
  reference: string;
  note?: string;
}) {
  const toneClasses =
    tone === "critical"
      ? "border-danger/25 bg-danger-light/40"
      : "border-border bg-surface/60";
  const pillClasses =
    tone === "critical"
      ? "bg-danger text-white"
      : "bg-warning text-white";
  const pillLabel = tone === "critical" ? "Критично" : "Средний";

  return (
    <div className={`rounded-xl border p-4 ${toneClasses}`}>
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${pillClasses}`}
        >
          {pillLabel}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {quote && (
            <p className="mt-1.5 text-xs italic leading-relaxed text-foreground/65">
              {quote}
            </p>
          )}
          <p className="mt-2 text-xs font-medium text-primary">{reference}</p>
          {note && (
            <p className="mt-1.5 text-xs leading-relaxed text-foreground/65">
              {note}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
