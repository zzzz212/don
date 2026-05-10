import { ImageResponse } from "next/og";

// 180×180 apple-touch-icon. Used by iOS / iPadOS when the user adds
// the site to their Home Screen — same brand-mark as the regular
// favicon but at the higher resolution iOS expects.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 120,
          fontWeight: 800,
          fontFamily: "Inter, system-ui, sans-serif",
          borderRadius: 36,
        }}
      >
        Ю
      </div>
    ),
    { ...size }
  );
}
