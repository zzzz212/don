import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
import { listPosts } from "@/lib/blog/posts";
import { BRAND } from "@/lib/legal-info";
import { Clock, ArrowRight } from "lucide-react";

// Blog index. The first SEO-tractable surface on the site — every
// post listed here also gets its own URL with proper canonical and
// JSON-LD Article schema. Newest first; manually-set publishedAt is
// the sort key so we don't depend on file-system mtime.

export const metadata: Metadata = {
  title: `Блог о договорном праве РФ — ${BRAND.name}`,
  description:
    "Разборы типовых договоров под российское право: налоги, NDA, аренда, ГПХ vs ИП. Со ссылками на статьи ГК и готовыми формулировками.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: `Блог — ${BRAND.name}`,
    description:
      "Разборы российских договоров со ссылками на ГК РФ и Постановления Пленумов ВС.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function BlogIndexPage() {
  const posts = listPosts();
  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main id="main-content" className="flex-1 bg-surface/30">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <header className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Журнал
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Разборы договоров под право РФ
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted">
              Без воды. По каждой теме — статьи ГК и ППВС, реальные суммы
              и сроки, формулировки, которые работают в суде. Каждая
              статья содержит ссылки на конкретные пункты, которые проверяет
              автоматический аудит ЮрИИст.
            </p>
          </header>

          <div className="space-y-4">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group block rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40 hover:bg-card sm:p-7"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-md bg-primary-light px-2 py-0.5 font-semibold text-primary-dark">
                    {post.category}
                  </span>
                  <span className="text-muted">
                    {formatDate(post.publishedAt)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-muted">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {post.readingTimeMin} мин
                  </span>
                </div>
                <h2 className="text-xl font-bold tracking-tight text-foreground group-hover:text-primary sm:text-2xl">
                  {post.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {post.lead}
                </p>
                <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                  Читать
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </p>
              </Link>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
            <p className="text-sm font-semibold text-foreground">
              Новые материалы — раз в неделю
            </p>
            <p className="mt-2 text-sm text-muted">
              Готовим разборы трудовых договоров, агентских, лицензионных
              и налоговых нюансов 2026. Подпишитесь на{" "}
              <Link
                href="https://t.me/juriist"
                className="font-semibold text-primary hover:underline"
              >
                Telegram-канал
              </Link>{" "}
              — анонсы там первыми.
            </p>
          </div>
        </div>
      </main>
      <Disclaimer />
    </div>
  );
}
