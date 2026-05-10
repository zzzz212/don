import { ImageResponse } from "next/og";

// Dynamic OG image for the landing page. next/og generates a 1200×630
// PNG at request time (cached aggressively by Vercel's edge), so the
// preview people see on Telegram / Twitter / Slack stays in sync with
// the brand without a designer touching Figma.
//
// We deliberately do NOT export `runtime = "edge"`. In Next 16,
// ImageResponse works fine in the default Node.js runtime, and
// declaring edge-runtime on a page disables static generation for it
// (the build emits a warning). The Node path also lets us reuse any
// future env-bound dependencies (Sentry, etc.) without per-route
// edge polyfills.
//
// Inlined fonts would bloat the route — we lean on Inter via system
// fallbacks (next/og's default).

export const alt = "ЮрИИст — AI-юрист для бизнеса";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
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
          padding: 80,
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {/* Brand chip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 60,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#4f46e5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 38,
              fontWeight: 800,
            }}
          >
            ⚖
          </div>
          <div
            style={{
              fontSize: 48,
              fontWeight: 800,
              color: "#0f172a",
              letterSpacing: -1,
            }}
          >
            ЮрИИст
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 96,
            fontWeight: 800,
            color: "#0f172a",
            lineHeight: 1.05,
            letterSpacing: -3,
            maxWidth: 980,
          }}
        >
          AI-юрист, который проверит договор за 30 секунд
        </div>

        {/* Subhead */}
        <div
          style={{
            marginTop: 28,
            fontSize: 32,
            color: "#475569",
            maxWidth: 860,
            lineHeight: 1.35,
          }}
        >
          Анализ рисков, генерация документов, проверка контрагентов — в одном
          сервисе.
        </div>

        {/* Footer mark */}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 24,
            color: "#64748b",
          }}
        >
          juriist.vercel.app
        </div>
      </div>
    ),
    { ...size }
  );
}
