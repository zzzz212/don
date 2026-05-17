import { ImageResponse } from "next/og";

// Programmatic favicon. Next 15+ picks this up for /favicon.ico-style
// requests automatically — no /public/icon.png to keep in sync, no
// designer round-trip when the brand colour shifts.

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          color: "#fff",
          fontSize: 22,
          fontWeight: 800,
          fontFamily: "Inter, system-ui, sans-serif",
          borderRadius: 7,
        }}
      >
        Я
      </div>
    ),
    { ...size }
  );
}
