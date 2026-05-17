import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
import { BRAND, CONTACTS } from "@/lib/legal-info";
import { ChevronDown, HelpCircle, ArrowRight, Mail } from "lucide-react";

// Public-facing FAQ. Two goals:
//   1. SEO — captures the "как X в договоре" / "что такое Y" long-tail
//      that doesn't fit a full article. Each question is a separate
//      <details> with an id; deep-link friendly.
//   2. Self-serve support — reduces email volume from prospects who
//      ask the same 15-20 questions before signing up.
//
// Inline JSON-LD FAQPage so Google renders rich result accordion in SERP.

export const metadata: Metadata = {
  title: `Частые вопросы — ${BRAND.name}`,
  description:
    "Ответы на 20 частых вопросов: как работает аудит договоров, какие модели используем, что с конфиденциальностью данных, тарифы и возврат денег, ограничения сервиса.",
  alternates: { canonical: "/help" },
  openGraph: {
    title: `Частые вопросы — ${BRAND.name}`,
    description: "Прямые ответы про аудит договоров, тарифы и работу сервиса.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

interface FaqItem {
  q: string;
  /** Plain-text answer for JSON-LD. Keep HTML out — schema doesn't like
   *  it. The rendered body uses the JSX in `answer` instead. */
  aText: string;
  /** Rendered body — can include JSX (links to articles, etc.). */
  answer: React.ReactNode;
}

const FAQS: FaqItem[] = [
  {
    q: "Что делает Яксо?",
    aText:
      "Автоматически проверяет договоры по российскому праву: находит несоразмерные штрафы, кабальные условия и пропущенные существенные пункты. Возвращает структурированный отчёт с цитатами из ГК РФ и готовыми формулировками правок. Дополнительно — генерирует 20 типов готовых договоров и ведёт историю правок с возможностью сравнения версий.",
    answer: (
      <>
        Автоматически проверяет договоры по российскому праву: находит
        несоразмерные штрафы, кабальные условия и пропущенные существенные
        пункты. Возвращает структурированный отчёт с цитатами из ГК РФ и
        готовыми формулировками правок. Дополнительно генерирует 20 типов
        готовых договоров.{" "}
        <Link href="/sample-report" className="font-medium text-primary underline">
          Посмотреть пример отчёта →
        </Link>
      </>
    ),
  },
  {
    q: "Какие модели AI используете?",
    aText:
      "На платных тарифах — Claude Sonnet 4.6 от Anthropic. На бесплатном «Старт» для анализа — Claude Haiku 4.5 (быстрее и дешевле, чуть менее детальный). На тарифе «Бизнес» анализ выполняется на Claude Opus 4.7 — самой точной модели на длинных договорах. Серверы Anthropic находятся в США.",
    answer: (
      <>
        На платных тарифах — Claude Sonnet 4.6 от Anthropic. На бесплатном
        «Старт» для анализа — Claude Haiku 4.5 (быстрее и дешевле, чуть
        менее детальный). На тарифе «Бизнес» анализ выполняется на Claude
        Opus 4.7 — самой точной модели на длинных договорах. Серверы
        Anthropic находятся в США (при регистрации вы даёте отдельное
        согласие на трансграничную передачу по ст. 12 152-ФЗ).
      </>
    ),
  },
  {
    q: "Можно ли доверять автоматическому анализу?",
    aText:
      "Отчёт — это автоматическая оценка рисков, формально не является юридической консультацией (ст. 779 ГК РФ). Качество анализа выше, чем у универсальных LLM, потому что в системный промпт зашит справочник из 60+ статей ГК и ППВС, модель цитирует их по фиксированному списку. Но для сделок с существенной ценой обязательно показывайте отчёт живому юристу.",
    answer: (
      <>
        Отчёт — это автоматическая оценка рисков, формально <strong>не
        является юридической консультацией</strong> (ст. 779 ГК РФ).
        Качество анализа выше, чем у универсального ChatGPT, потому что в
        системный промпт зашит справочник из 60+ статей ГК и ППВС —
        модель цитирует по фиксированному списку, реже выдумывает номера.
        Но для сделок с существенной ценой обязательно показывайте отчёт
        живому юристу.
      </>
    ),
  },
  {
    q: "Какие документы поддерживаются?",
    aText:
      "PDF и DOCX размером до 10 МБ. Поддерживаются договоры на русском языке любого типа: услуги, аренда, купля-продажа, поставка, NDA, трудовые, агентские, заём, лицензионный. Для сканированных PDF на платных тарифах автоматически подключается OCR через Yandex Vision.",
    answer: (
      <>
        PDF и DOCX размером до 10 МБ. Поддерживаются договоры на русском
        языке любого типа: услуги, аренда, купля-продажа, поставка, NDA,
        трудовые, агентские, заём, лицензионный. Для сканированных PDF на
        платных тарифах автоматически подключается OCR через Yandex Vision.
      </>
    ),
  },
  {
    q: "Сколько времени занимает анализ?",
    aText:
      "Короткие договоры (до 50 000 символов, примерно 20 страниц) — 30-60 секунд за один проход. Длинные режутся на главы и обрабатываются параллельно с дедупликацией повторных рисков — обычно 1-3 минуты на договор в 50+ страниц.",
    answer: (
      <>
        Короткие договоры (до 50 000 символов, примерно 20 страниц) —
        30-60 секунд за один проход. Длинные режутся на главы и
        обрабатываются параллельно с дедупликацией повторных рисков —
        обычно 1-3 минуты на договор в 50+ страниц.
      </>
    ),
  },
  {
    q: "Где хранятся загруженные документы?",
    aText:
      "Текст и метаданные документа хранятся в зашифрованной БД Neon Postgres (ЕС / РФ в зависимости от региона). Оригинальные файлы — в Vercel Blob с TLS-шифрованием. Инференс модели проходит на серверах Anthropic в США. Подробнее — на странице Политика конфиденциальности.",
    answer: (
      <>
        Текст и метаданные документа хранятся в зашифрованной БД Neon
        Postgres. Оригинальные файлы — в Vercel Blob с TLS-шифрованием.
        Инференс модели проходит на серверах Anthropic в США. Подробнее —
        на странице{" "}
        <Link href="/privacy" className="font-medium text-primary underline">
          Политика конфиденциальности
        </Link>
        .
      </>
    ),
  },
  {
    q: "Можно ли удалить свои документы?",
    aText:
      "Да. На странице «Документы» / «Шаблоны» есть кнопка удаления у каждого файла. После удаления документ полностью убирается из БД и хранилища в течение 24 часов. Audit-запись об удалении сохраняется (без содержания документа) — это требование 152-ФЗ.",
    answer: (
      <>
        Да. На странице «Документы» и «Шаблоны» есть кнопка удаления у
        каждого файла. После удаления документ полностью убирается из БД
        и хранилища в течение 24 часов. Audit-запись об удалении
        сохраняется (без содержания документа) — это требование 152-ФЗ.
      </>
    ),
  },
  {
    q: "Что такое тариф «Старт» и какие там лимиты?",
    aText:
      "Бесплатный план: 10 анализов договоров в месяц, 5 генераций документов, безлимитный чат-юрист, без OCR для скан-PDF. Без привязки карты, без автосписаний. Подходит для оценки сервиса и эпизодической работы с договорами.",
    answer: (
      <>
        Бесплатный план: 10 анализов договоров в месяц, 5 генераций
        документов, безлимитный чат-юрист, без OCR для скан-PDF. Без
        привязки карты, без автосписаний. Подходит для оценки сервиса и
        эпизодической работы с договорами.
      </>
    ),
  },
  {
    q: "Чем отличаются Pro Solo, Pro Team и Business?",
    aText:
      "Pro Solo (1 990 ₽/мес) — 100 анализов в месяц, безлимит на генерацию и чат, OCR. Подходит для ИП и фрилансеров. Pro Team (4 990 ₽/мес) — до 5 участников рабочего пространства, 500 анализов на команду, совместная история. Business (14 990 ₽/мес) — безлимитные анализы на самой точной модели Opus, расширенная история, персональный менеджер.",
    answer: (
      <>
        <strong>Pro Solo</strong> (1 990 ₽/мес) — 100 анализов в месяц,
        безлимит на генерацию и чат, OCR. Для ИП и фрилансеров.{" "}
        <strong>Pro Team</strong> (4 990 ₽/мес) — до 5 участников, 500
        анализов на команду. <strong>Business</strong> (14 990 ₽/мес) —
        безлимитные анализы на Opus, персональный менеджер.{" "}
        <Link href="/billing" className="font-medium text-primary underline">
          Подробнее →
        </Link>
      </>
    ),
  },
  {
    q: "Как активировать бесплатный пробный период «Про»?",
    aText:
      "В разделе «Тариф и биллинг» есть кнопка активации триала на 2 дня. Без привязки карты, без автосписаний. Доступно один раз для каждого аккаунта.",
    answer: (
      <>
        В разделе{" "}
        <Link href="/billing" className="font-medium text-primary underline">
          «Тариф и биллинг»
        </Link>{" "}
        есть кнопка активации триала на 2 дня. Без привязки карты, без
        автосписаний. Доступно один раз для каждого аккаунта.
      </>
    ),
  },
  {
    q: "Как отменить подписку?",
    aText:
      "В разделе «Тариф и биллинг» нажмите «Отменить подписку». Доступ к функциям тарифа сохраняется до конца оплаченного периода, потом аккаунт автоматически переключится на «Старт». Возврат за неиспользованную часть — по правилам публичной оферты.",
    answer: (
      <>
        В разделе{" "}
        <Link href="/billing" className="font-medium text-primary underline">
          «Тариф и биллинг»
        </Link>{" "}
        нажмите «Отменить подписку». Доступ к функциям тарифа сохраняется
        до конца оплаченного периода, потом аккаунт переключится на
        «Старт». Возврат за неиспользованную часть — по правилам{" "}
        <Link href="/offer" className="font-medium text-primary underline">
          публичной оферты
        </Link>
        .
      </>
    ),
  },
  {
    q: "Можно ли работать в команде?",
    aText:
      "Да. На тарифах Pro Team (до 5 участников) и Business (до 20 участников) можно пригласить коллег в рабочее пространство. У каждого участника своя роль: OWNER (владелец, биллинг), ADMIN (приглашать/удалять участников), MEMBER (только использование). История анализов и шаблонов общая.",
    answer: (
      <>
        Да. На тарифах Pro Team (до 5 участников) и Business (до 20
        участников) можно пригласить коллег в рабочее пространство. Роли:
        OWNER (биллинг), ADMIN (приглашать/удалять), MEMBER (только
        использование). История анализов и шаблонов общая.
      </>
    ),
  },
  {
    q: "Что делать, если AI ошибся в отчёте?",
    aText:
      "Напишите в поддержку на support@yakso.ru с приложением отчёта и описанием ошибки. Мы используем такие случаи для улучшения промпта и сверки справочника статей. За критичные находки готовы вернуть стоимость анализа или предоставить дополнительные проверки.",
    answer: (
      <>
        Напишите в поддержку на{" "}
        <a
          href={`mailto:${CONTACTS.support}`}
          className="font-medium text-primary underline"
        >
          {CONTACTS.support}
        </a>{" "}
        с приложением отчёта и описанием ошибки. Используем такие случаи
        для улучшения промпта. За критичные находки готовы вернуть
        стоимость анализа или предоставить дополнительные проверки.
      </>
    ),
  },
  {
    q: "Можно ли использовать сгенерированные шаблоны без юриста?",
    aText:
      "Для типовых сделок небольшого объёма — да, шаблоны рабочие и проходят формальные требования ГК РФ. Для сделок с существенной ценой (от ~500 тыс. руб.), уникальной структурой, иностранными контрагентами и интеллектуальной собственностью — лучше показать юристу.",
    answer: (
      <>
        Для типовых сделок небольшого объёма — да, шаблоны рабочие и
        проходят формальные требования ГК РФ. Для сделок с существенной
        ценой (от ~500 тыс. руб.), уникальной структурой, иностранными
        контрагентами и интеллектуальной собственностью — лучше показать
        юристу.
      </>
    ),
  },
  {
    q: "Можно ли применить правки прямо в документе?",
    aText:
      "Да. В отчёте под каждым риском есть кнопка «Применить» — она заменяет проблемный фрагмент текста на рекомендованный. Применённые правки накапливаются, итог можно скачать в DOCX. Также сохраняется история версий с возможностью сравнения и отката.",
    answer: (
      <>
        Да. В отчёте под каждым риском есть кнопка «Применить» — она
        заменяет проблемный фрагмент текста на рекомендованный.
        Применённые правки накапливаются, итог можно скачать в DOCX.
        Сохраняется история версий с возможностью сравнения и отката.
      </>
    ),
  },
  {
    q: "Есть ли проверка контрагентов?",
    aText:
      "Да, на странице «Контрагенты». Базовая проверка по ЕГРЮЛ через DaData — выписка, статус, ОКВЭД, дата регистрации, адрес. Информация по арбитражным делам (КАД) и исполнительным производствам (ФССП) пока в разработке.",
    answer: (
      <>
        Да, на странице{" "}
        <Link
          href="/counterparty"
          className="font-medium text-primary underline"
        >
          «Контрагенты»
        </Link>
        . Базовая проверка по ЕГРЮЛ через DaData — выписка, статус, ОКВЭД,
        дата регистрации, адрес. Проверка по арбитражным делам (КАД) и
        исполнительным производствам (ФССП) пока в разработке.
      </>
    ),
  },
  {
    q: "Где почитать про конкретные виды договоров?",
    aText:
      "В журнале Яксо есть разборы: ГПХ vs ИП, NDA для IT-компаний, аренда нежилого помещения, договор оказания услуг, маркетплейс-агентский, поставка, трудовой с испытательным сроком, заём между ЮЛ, агентский. Каждая статья со ссылками на статьи ГК и готовыми формулировками.",
    answer: (
      <>
        В{" "}
        <Link href="/blog" className="font-medium text-primary underline">
          журнале Яксо
        </Link>{" "}
        есть разборы: ГПХ vs ИП, NDA для IT, аренда, договор услуг,
        маркетплейс, поставка, трудовой с испытательным сроком, заём
        между ЮЛ, агентский. Каждая статья со ссылками на статьи ГК и
        готовыми формулировками.
      </>
    ),
  },
  {
    q: "Можно ли подключить сервис к 1С или Битрикс24?",
    aText:
      "Прямой интеграции пока нет. На тарифе Business планируется API для отправки документов на анализ — обещаемая дата: 2026 год. Если у вас крупная компания и нужна интеграция уже сейчас — напишите на support@yakso.ru, обсудим.",
    answer: (
      <>
        Прямой интеграции пока нет. На тарифе Business планируется API
        для отправки документов — обещаемая дата 2026. Если нужна
        интеграция уже сейчас — напишите на{" "}
        <a
          href={`mailto:${CONTACTS.support}`}
          className="font-medium text-primary underline"
        >
          {CONTACTS.support}
        </a>
        .
      </>
    ),
  },
  {
    q: "Возможна ли on-premise установка?",
    aText:
      "Да, для тарифа Enterprise. Условия — индивидуальные, под ваши требования по data residency. Свяжитесь через support@yakso.ru для обсуждения.",
    answer: (
      <>
        Да, для тарифа{" "}
        <Link href="/billing" className="font-medium text-primary underline">
          Enterprise
        </Link>
        . Условия — индивидуальные, под ваши требования по data residency.
        Свяжитесь через{" "}
        <a
          href={`mailto:${CONTACTS.support}`}
          className="font-medium text-primary underline"
        >
          {CONTACTS.support}
        </a>{" "}
        для обсуждения.
      </>
    ),
  },
  {
    q: "Как связаться с поддержкой?",
    aText:
      "Email: support@yakso.ru. Отвечаем в течение 24 часов в будние дни. По вопросам, связанным с конкретными отчётами, прикладывайте ID документа из URL отчёта — это ускорит разбор.",
    answer: (
      <>
        Email:{" "}
        <a
          href={`mailto:${CONTACTS.support}`}
          className="font-medium text-primary underline"
        >
          {CONTACTS.support}
        </a>
        . Отвечаем в течение 24 часов в будние дни. По вопросам про
        конкретные отчёты прикладывайте ID документа из URL — это ускорит
        разбор.
      </>
    ),
  },
];

export default function HelpPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.aText,
      },
    })),
  };

  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main id="main-content" className="flex-1 bg-surface/30">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <header className="mb-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light text-primary">
              <HelpCircle className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Частые вопросы
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-muted">
              Прямые ответы. Без маркетинговых формулировок. Не нашли свой
              вопрос — напишите на{" "}
              <a
                href={`mailto:${CONTACTS.support}`}
                className="font-medium text-primary hover:underline"
              >
                {CONTACTS.support}
              </a>
              .
            </p>
          </header>

          <div className="space-y-3">
            {FAQS.map((item, i) => (
              <details
                key={i}
                id={`q-${i + 1}`}
                className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-border-strong"
              >
                <summary className="flex cursor-pointer items-start justify-between gap-3 text-base font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                  <span>{item.q}</span>
                  <ChevronDown
                    className="mt-0.5 h-5 w-5 shrink-0 text-muted transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="mt-3 text-sm leading-relaxed text-muted">
                  {item.answer}
                </div>
              </details>
            ))}
          </div>

          {/* Bottom CTA — both for visitors who searched here from Google
              and for existing users who came looking for a specific
              answer. */}
          <section className="mt-12 rounded-2xl border border-primary/30 bg-primary-light/40 p-6 sm:p-8">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-base font-bold text-foreground">
                  Не нашли ответа?
                </p>
                <p className="mt-1 text-sm text-muted">
                  Напишите — ответим в течение 24 часов в будние дни.
                </p>
              </div>
              <a
                href={`mailto:${CONTACTS.support}`}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 transition-colors hover:bg-primary-dark"
              >
                <Mail className="h-4 w-4" />
                Написать в поддержку
              </a>
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-border bg-card p-6">
            <p className="text-base font-bold text-foreground">
              Готовы попробовать?
            </p>
            <p className="mt-1 text-sm text-muted">
              10 анализов в месяц бесплатно, без привязки карты.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/sample-report"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface"
              >
                Посмотреть пример отчёта
              </Link>
              <Link
                href="/analyze"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
              >
                Загрузить договор
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        </div>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Disclaimer />
    </div>
  );
}
