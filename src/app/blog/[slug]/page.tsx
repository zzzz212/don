import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Disclaimer } from "@/components/disclaimer";
import { getPost, listPosts } from "@/lib/blog/posts";
import { BRAND } from "@/lib/legal-info";
import { ArrowLeft, Clock, ArrowRight, Sparkles } from "lucide-react";

// Single blog post route. Generates static metadata + JSON-LD Article
// structured data so Google Search / Yandex Webmaster can render rich
// results. generateStaticParams pre-builds every post at build time —
// the corpus is small and static, no reason to do this dynamically.

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return listPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: `Не найдено — ${BRAND.name}` };

  const url = `${BRAND.publicUrl}/blog/${post.slug}`;
  return {
    title: `${post.title} — ${BRAND.name}`,
    description: post.description,
    keywords: post.keywords,
    authors: [{ name: post.author }],
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url,
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      authors: [post.author],
      siteName: BRAND.name,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
    robots: { index: true, follow: true },
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function BlogPostPage({ params }: RouteParams) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const Body = post.Body;

  // Schema.org Article — gives Google enough to render rich result chips
  // (date, author, reading time). Inline JSON-LD; safe because we
  // generate the string from typed fields.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    author: { "@type": "Organization", name: post.author },
    publisher: {
      "@type": "Organization",
      name: BRAND.name,
      logo: {
        "@type": "ImageObject",
        url: `${BRAND.publicUrl}/icon`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${BRAND.publicUrl}/blog/${post.slug}`,
    },
    keywords: post.keywords.join(", "),
    inLanguage: "ru-RU",
  };

  // Related posts: everything except current, newest-first, capped 3.
  const related = listPosts()
    .filter((p) => p.slug !== post.slug)
    .slice(0, 3);

  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main id="main-content" className="flex-1 bg-surface/30">
        <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <Link
            href="/blog"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Ко всем статьям
          </Link>

          <header className="mb-8">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-md bg-primary-light px-2 py-0.5 font-semibold text-primary-dark">
                {post.category}
              </span>
              <span className="text-muted">
                {formatDate(post.publishedAt)}
              </span>
              <span className="inline-flex items-center gap-1 text-muted">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {post.readingTimeMin} мин на чтение
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {post.title}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-muted">
              {post.lead}
            </p>
            <p className="mt-4 text-xs text-muted">
              {post.author}
            </p>
          </header>

          <div className="prose-content">
            <Body />
          </div>

          {/* Bottom callout — anyone who read to here is high-intent.
              Single primary CTA — don't paralyse the choice. */}
          <section className="mt-16 rounded-2xl border border-primary/30 bg-primary-light/40 p-6 sm:p-8">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-foreground">
                  Проверьте свой договор по этим пунктам автоматически
                </h2>
                <p className="mt-2 text-sm text-muted">
                  ЮрИИст пройдёт по вашему документу с тем же справочником
                  из ГК РФ, что упомянут в статье. Найдёт несоразмерные
                  штрафы, кабальные условия и пропущенные существенные
                  пункты. 10 анализов в месяц бесплатно.
                </p>
                <Link
                  href="/analyze"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 transition-colors hover:bg-primary-dark"
                >
                  Загрузить договор
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </section>

          {related.length > 0 && (
            <section className="mt-12">
              <h2 className="text-lg font-bold text-foreground">
                Похожие материалы
              </h2>
              <div className="mt-4 space-y-3">
                {related.map((p) => (
                  <Link
                    key={p.slug}
                    href={`/blog/${p.slug}`}
                    className="group block rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                  >
                    <p className="text-xs text-muted">{p.category}</p>
                    <p className="mt-0.5 text-base font-semibold text-foreground group-hover:text-primary">
                      {p.title}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <p className="mt-12 text-center text-xs text-muted">
            Эта статья носит информационный характер и не является
            юридической консультацией.
          </p>
        </article>
      </main>

      {/* JSON-LD must live inside the <main> or footer so it's part of
          the response body the crawler sees. Inline script with
          dangerouslySetInnerHTML is the documented Next.js pattern for
          structured data. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Disclaimer />
    </div>
  );
}
