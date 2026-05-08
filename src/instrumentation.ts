// Server-side Sentry initialisation. Called by Next.js once per process on
// boot — both for the Node.js runtime (API routes, RSC) and the Edge runtime
// (middleware, edge route handlers). Each branch uses a different SDK
// import path because the Edge bundle has no Node-specific instrumentation.
//
// Initialisation is conditional on SENTRY_DSN — without the env var the SDK
// is not imported at all, keeping the bundle clean for self-hosting setups
// that don't want telemetry.

export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
      // Sample 10% of traces in production, 100% in dev so we see everything
      // locally if we ever turn it on.
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      // Strip noisy events: rate-limit responses, cache misses, etc. surface
      // through Sentry as 4xx — we already have AiUsage / structured logs for
      // those. Keep 5xx and unhandled exceptions only.
      beforeSend(event) {
        const status = (event.request as { status_code?: number } | undefined)
          ?.status_code;
        if (status && status >= 400 && status < 500) return null;
        return event;
      },
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    });
  }
}

// Optional but recommended: forward request errors so we get a clean
// "request failed" event tied to the route, not a bare uncaught exception.
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string | string[]> },
  context: { routerKind: "Pages Router" | "App Router"; routePath: string; routeType: "render" | "route" | "action" | "middleware" }
) {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(err, request, context);
}
