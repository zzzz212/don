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

export const alt = "Яксо — юрист, который читает договор за вас";
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
            "linear-gradient(135deg, #ebe0cd 0%, #f5eddf 55%, #fbf5ec 100%)",
          padding: 80,
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {/* Brand mark — warm-ink tile, serif "Я" */}
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
              background: "#1f1b16",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fcf7ef",
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
              color: "#1f1b16",
              fontFamily: SERIF,
              letterSpacing: -0.5,
            }}
          >
            Яксо
          </div>
        </div>

        {/* Headline — terracotta accent on the closing phrase mirrors the
            landing's italic "за вас". Two stacked divs because Satori
            (next/og's renderer) needs explicit display:flex on any
            container with more than one child — easier to split the
            phrase into two display:block lines than to wrap inline. */}
        <div
          style={{
            fontSize: 88,
            fontWeight: 600,
            color: "#1f1b16",
            fontFamily: SERIF,
            lineHeight: 1.08,
            letterSpacing: -2,
            maxWidth: 1000,
          }}
        >
          Юрист, который читает
        </div>
        <div
          style={{
            fontSize: 88,
            fontWeight: 600,
            fontStyle: "italic",
            color: "#c2613f",
            fontFamily: SERIF,
            lineHeight: 1.08,
            letterSpacing: -2,
            maxWidth: 1000,
          }}
        >
          договор за вас.
        </div>

        {/* Subhead */}
        <div
          style={{
            marginTop: 28,
            fontSize: 31,
            color: "#6b6258",
            maxWidth: 880,
            lineHeight: 1.35,
          }}
        >
          Загрузите PDF или DOCX. Через минуту увидите, на что обратить
          внимание — со ссылками на ГК и готовыми формулировками правок.
        </div>

        {/* Footer mark */}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 24,
            color: "#6b6258",
          }}
        >
          yakso.ru
        </div>
      </div>
    ),
    { ...size }
  );
}
