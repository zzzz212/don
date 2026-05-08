// Thin Sentry wrapper. Lets the rest of the codebase report errors without
// importing @sentry/nextjs everywhere — and degrades to console.error when
// Sentry is not configured, so unit tests don't need a Sentry mock.

type TelemetryContext = {
  /** Free-form name of the operation, e.g. "analyze.chunk" */
  op?: string;
  /** Arbitrary tags for filtering in Sentry */
  tags?: Record<string, string | number | boolean>;
  /** Extra non-indexed context */
  extra?: Record<string, unknown>;
  /** User attribution — never send raw PII like name/email */
  userId?: string | null;
};

function isSentryEnabled(): boolean {
  return !!process.env.SENTRY_DSN || !!process.env.NEXT_PUBLIC_SENTRY_DSN;
}

/**
 * Send an error to Sentry with structured context. Always logs to console
 * too so existing error tracking works without Sentry configured.
 */
export async function reportError(
  error: unknown,
  context: TelemetryContext = {}
): Promise<void> {
  console.error(
    `[${context.op ?? "error"}]`,
    error instanceof Error ? error.message : error,
    context.extra ?? ""
  );

  if (!isSentryEnabled()) return;

  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.withScope((scope) => {
      if (context.op) scope.setTag("op", context.op);
      if (context.tags) {
        for (const [k, v] of Object.entries(context.tags)) scope.setTag(k, v);
      }
      if (context.extra) {
        for (const [k, v] of Object.entries(context.extra)) {
          scope.setExtra(k, v);
        }
      }
      if (context.userId) scope.setUser({ id: context.userId });
      Sentry.captureException(error);
    });
  } catch (sentryError) {
    // Sentry itself failed — never let that break the request.
    console.error("[telemetry] failed to report:", sentryError);
  }
}

/**
 * Lightweight breadcrumb for tracing — best-effort, ignored if Sentry off.
 */
export async function addBreadcrumb(message: string, data?: Record<string, unknown>) {
  if (!isSentryEnabled()) return;
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.addBreadcrumb({ message, data, level: "info" });
  } catch {
    // ignore
  }
}
