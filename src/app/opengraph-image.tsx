import { ImageResponse } from "next/og";

// Dynamic OG image for the landing page. next/og generates a 1200×630
// PNG at request time (cached aggressively by Vercel's edge), so the
// preview people see on Telegram / Twitter / Slack stays in sync with
// the brand without a designer touching Figma.
//
// We deliberately do NOT export `runtime = "edge"`. In Next 16,
// ImageResponse works fine in the default Node.js runtime, and
// declaring edge-runtime on a page disables static generation for it.
//
// Display type is set in a serif (Georgia — a safe Cyrillic-capable
// fallback for the app's Source Serif) to match the redesigned brand.

export const alt = "Яксо — аудит договоров со ссылками на ГК РФ";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SERIF = 'Georgia, "Times New Roman", serif';

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
            "linear-gradient(135deg, #f1efe9 0%, #eceffa 55%, #fbfaf8 100%)",
          padding: 80,
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {/* Brand mark — ink tile, serif "Я" */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            marginBottom: 60,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              background: "#16202e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fbfaf8",
              fontSize: 36,
              fontWeight: 600,
              fontFamily: SERIF,
            }}
          >
            Я
          </div>
          <div
            style={{
              fontSize: 46,
              fontWeight: 600,
              color: "#16202e",
              fontFamily: SERIF,
              letterSpacing: -0.5,
            }}
          >
            Яксо
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 88,
            fontWeight: 600,
            color: "#16202e",
            fontFamily: SERIF,
            lineHeight: 1.08,
            letterSpacing: -2,
            maxWidth: 1000,
          }}
        >
          Аудит договоров. Со ссылками на закон.
        </div>

        {/* Subhead */}
        <div
          style={{
            marginTop: 28,
            fontSize: 31,
            color: "#5b6573",
            maxWidth: 880,
            lineHeight: 1.35,
          }}
        >
          60+ статей ГК и ППВС в каждом отчёте. Готовые формулировки правок.
          10 проверок в месяц бесплатно.
        </div>

        {/* Footer mark */}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 24,
            color: "#5b6573",
          }}
        >
          yakso.ru
        </div>
      </div>
    ),
    { ...size }
  );
}
