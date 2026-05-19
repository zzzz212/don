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
            "linear-gradient(135deg, #f1efe9 0%, #eceffa 55%, #fbfaf8 100%)",
          padding: 72,
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {/* Brand strip — ink tile, serif "Я" */}
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
              background: "#16202e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fbfaf8",
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
              color: "#16202e",
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
              color: "#5b6573",
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
            background: "#e9edfb",
            color: "#1c399e",
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
            color: "#16202e",
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
            color: "#5b6573",
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
