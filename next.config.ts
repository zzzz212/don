import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "mammoth", "pdfkit", "voyageai"],
};

// Wrap with Sentry only when telemetry is configured. Without SENTRY_DSN the
// wrapper is still safe — it just compiles the Sentry SDK into the bundle —
// but we skip it locally to keep build output noise-free.
const config: NextConfig =
  process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
    ? withSentryConfig(nextConfig, {
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        // Auth token only required for source map upload during build —
        // optional locally; CI sets SENTRY_AUTH_TOKEN.
        authToken: process.env.SENTRY_AUTH_TOKEN,
        silent: !process.env.CI,
        widenClientFileUpload: true,
        // Tunnel: route Sentry's ingress through our own /monitoring path
        // to bypass ad blockers. Off by default — enable if you see
        // sample loss in prod.
        // tunnelRoute: "/monitoring",

        // Replaces the deprecated `disableLogger: true` flag in Sentry
        // SDK 10.x — strips Sentry's internal debug logging from the
        // production bundle via webpack tree-shaking. Turbopack ignores
        // this in `next dev`; the flag only matters for `next build`.
        webpack: {
          treeshake: {
            removeDebugLogging: true,
          },
        },
      })
    : nextConfig;

export default config;
