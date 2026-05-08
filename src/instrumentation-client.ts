// Client-side Sentry initialisation. Loaded into every browser bundle
// automatically by Next.js — but only fires Sentry.init when both the
// public DSN env var is set AND we are actually running in the browser.
//
// The DSN must be NEXT_PUBLIC_-prefixed so it ships to the client; this is
// the standard Sentry pattern and the DSN itself is not a secret (it just
// identifies the project — write-only credential).

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_VERCEL_ENV ??
      process.env.NODE_ENV ??
      "development",

    // Browser performance — keep low; expand later when we actually look at
    // these dashboards.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 0.5,

    // Replay session recordings: off by default. Turn on per-tier when we
    // want to inspect live UX bugs from real users.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // Filter out the same 4xx noise as the server.
    beforeSend(event) {
      const status = (event.request as { status_code?: number } | undefined)
        ?.status_code;
      if (status && status >= 400 && status < 500) return null;
      return event;
    },
  });
}

// Required export so Next.js' router-transition instrumentation works.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
