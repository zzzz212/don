import { ImageResponse } from "next/og";
import { getPost, listPosts } from "@/lib/blog/posts";

// Per-post OG image. next/og runs at request time and the result is
// edge-cached, so visiting /blog/<slug> and sharing the link in Telegram
// or Slack pulls a 1200×630 PNG that reflects this specific post's
// title and category. Without this every shared blog link would get
// the generic landing OG card and look like "yet another marketing
// page" — kills click-through on social.
//
// generateImageMetadata maps every published slug to a single image
// variant (we don't have light/dark or per-language variants). It also
// pre-warms the cache at build time for SSG'd routes via the
// generateStaticParams on the page itself.

export const alt = "ЮрИИст — статья блога";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export async function generateImageMetadata() {
  return listPosts().map((post) => ({
    id: post.slug,
    alt: post.title,
    size,
    contentType,
  }));
}

export default async function BlogPostOg({
  params,
}: {
  params: { slug: string };
}) {
  const post = getPost(params.slug);
  const title = post?.title ?? "Блог ЮрИИст";
  const category = post?.category ?? "Договорное право РФ";
  const reading = post ? `${post.readingTimeMin} мин чтения` : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #f8fafc 0%, #eff6ff 50%, #ffffff 100%)",
          padding: 72,
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {/* Brand strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "#4f46e5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 30,
              fontWeight: 800,
            }}
          >
            ⚖
          </div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 800,
              color: "#0f172a",
              letterSpacing: -0.5,
            }}
          >
            ЮрИИст
          </div>
          <div
            style={{
              marginLeft: 8,
              fontSize: 22,
              color: "#64748b",
            }}
          >
            · Журнал
          </div>
        </div>

        {/* Category chip */}
        <div
          style={{
            display: "inline-flex",
            alignSelf: "flex-start",
            padding: "8px 16px",
            borderRadius: 999,
            background: "#eef2ff",
            color: "#3730a3",
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 0.3,
            textTransform: "uppercase",
            marginBottom: 28,
          }}
        >
          {category}
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: title.length > 80 ? 56 : 68,
            fontWeight: 800,
            color: "#0f172a",
            lineHeight: 1.1,
            letterSpacing: -1.5,
            maxWidth: 1020,
          }}
        >
          {title}
        </div>

        {/* Footer mark */}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 22,
            color: "#64748b",
          }}
        >
          <div>juriist.vercel.app/blog</div>
          {reading && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              📖 {reading}
            </div>
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
