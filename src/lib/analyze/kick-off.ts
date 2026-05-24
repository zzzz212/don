// Fire-and-forget HTTP call to /api/analyze/run, with a small retry
// loop in case the first fetch is dropped (cold start race, transient
// network). The cron at /api/cron/restart-stuck-analyses is the true
// safety net — if both retries fail, the row stays PENDING and the
// cron will reattempt within ~5 minutes.
//
// Auth: x-internal-token header with INTERNAL_SECRET. Production MUST
// set this env var; missing secret in production logs an error and
// declines to kick off (caller's Analysis row stays PENDING, cron will
// pick it up but won't be able to authenticate either — surfacing the
// misconfiguration visibly).

import { BRAND } from "@/lib/legal-info";

const RETRY_DELAYS_MS = [0, 1_000]; // 2 attempts, 1s between

export async function kickOffBackgroundAnalyze(analysisId: string): Promise<void> {
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) {
    console.error(
      "[analyze.kick-off] INTERNAL_SECRET not set — cannot kick off background worker. " +
        "Set INTERNAL_SECRET in Vercel project env vars."
    );
    return;
  }

  const url = `${BRAND.publicUrl}/api/analyze/run`;

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
    try {
      // Fire-and-forget: we do NOT await response.json() or response body.
      // We do await the initial fetch() promise enough to confirm Vercel
      // accepted the connection (request line + headers were transmitted),
      // then return immediately. The function on the other side runs to
      // completion independently.
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-token": secret,
        },
        body: JSON.stringify({ analysisId }),
      });
      // Don't drain the body — let Vercel's function continue. We only
      // need to know the connection was accepted.
      if (res.ok || res.status === 204) {
        return;
      }
      console.warn(
        `[analyze.kick-off] /run returned ${res.status} for ${analysisId} (attempt ${attempt + 1})`
      );
    } catch (err) {
      console.warn(
        `[analyze.kick-off] fetch failed for ${analysisId} (attempt ${attempt + 1}):`,
        (err as Error).message
      );
    }
  }

  // Both attempts failed. The row stays PENDING — cron will retry.
  console.error(
    `[analyze.kick-off] both kick-off attempts failed for ${analysisId}. ` +
      "Cron /api/cron/restart-stuck-analyses will pick it up within 5min."
  );
}
