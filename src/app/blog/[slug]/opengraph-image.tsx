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
// variant (we don't have light/dark or per-language variants).

export const alt = "Яксо — статья блога";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SERIF = 'Georgia, "Times New Roman", serif';

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
  const title = post?.title ?? "Блог Яксо";
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
            "linear-gradient(135deg, #ebe0cd 0%, #f5eddf 55%, #fbf5ec 100%)",
          padding: 72,
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {/* Brand strip — warm-ink tile, serif "Я" */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: "#1f1b16",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fcf7ef",
              fontSize: 29,
              fontWeight: 600,
              fontFamily: SERIF,
            }}
          >
            Я
          </div>
          <div
            style={{
              fontSize: 35,
              fontWeight: 600,
              color: "#1f1b16",
              fontFamily: SERIF,
              letterSpacing: -0.5,
            }}
          >
            Яксо
          </div>
          <div
            style={{
              marginLeft: 8,
              fontSize: 22,
              color: "#6b6258",
            }}
          >
            · Журнал
          </div>
        </div>

        {/* Category chip — terracotta tint on cream. */}
        <div
          style={{
            display: "inline-flex",
            alignSelf: "flex-start",
            padding: "8px 16px",
            borderRadius: 999,
            background: "#f4dcc9",
            color: "#a24e30",
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
            fontSize: title.length > 80 ? 54 : 66,
            fontWeight: 600,
            color: "#1f1b16",
            fontFamily: SERIF,
            lineHeight: 1.12,
            letterSpacing: -1,
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
            color: "#6b6258",
          }}
        >
          <div>yakso.ru/blog</div>
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
