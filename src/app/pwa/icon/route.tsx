import { ImageResponse } from "next/og";

// Generated PWA icons. The manifest references /pwa/icon?size=192,
// ?size=512 and ?size=512&maskable=1 — one route covers every variant,
// so there are no binary PNGs to commit and keep in sync with the
// brand colour.
//
// nodejs runtime (not edge): matches the other ImageResponse routes in
// this app — edge was dropped because it disabled static generation.
export const runtime = "nodejs";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const size = searchParams.get("size") === "512" ? 512 : 192;
  const maskable = searchParams.get("maskable") === "1";

  // A maskable icon is cropped by the OS to its own shape, so the glyph
  // must stay inside the ~80% safe zone and the corners stay square
  // (the OS rounds them). A plain "any" icon can fill more and round
  // its own corners.
  const glyph = Math.round(size * (maskable ? 0.44 : 0.62));
  const radius = maskable ? 0 : Math.round(size * 0.22);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#4f46e5",
          color: "#ffffff",
          fontSize: glyph,
          fontWeight: 800,
          fontFamily: "Inter, system-ui, sans-serif",
          borderRadius: radius,
        }}
      >
        Я
      </div>
    ),
    {
      width: size,
      height: size,
      headers: {
        "Cache-Control": "public, max-age=86400, immutable",
      },
    }
  );
}
