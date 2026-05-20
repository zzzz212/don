import { ImageResponse } from "next/og";

// 180×180 apple-touch-icon. Used by iOS / iPadOS when the user adds the
// site to their Home Screen — the same ink-tile serif mark as the
// favicon, at the resolution iOS expects.

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
          background: "#1f1b16",
          color: "#fcf7ef",
          fontSize: 104,
          fontWeight: 600,
          fontFamily: 'Georgia, "Times New Roman", serif',
          borderRadius: 40,
        }}
      >
        Я
      </div>
    ),
    { ...size }
  );
}
