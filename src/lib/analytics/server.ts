// Server-side PostHog tracking. Used from API routes and server actions.
//
// Design decisions:
//   1. PII-free by construction. We pass userId (cuid) as distinctId and
//      never include email / name / document content in event properties.
//      Only opaque ids (orgId, paymentId) and categorical fields (plan,
//      feature, mode) flow through.
//   2. Fire-and-forget. captureEvent never blocks the response — failures
//      are swallowed (logged to console once). Analytics that races with
//      the request lifecycle isn't worth a 500.
//   3. Lazy import. posthog-node is only loaded when POSTHOG_API_KEY is
//      configured, so the bundle stays clean for envs without analytics.
//   4. flushAt:1 — Vercel serverless recycles workers aggressively, so
//      buffering events between calls reliably loses them. Send each
//      event the moment we capture it; PostHog SDK handles batching
//      across multiple captures within the same lifecycle.

import { reportError } from "@/lib/telemetry";

// PostHog node client surface we actually use. Defining it here lets us
// avoid importing the type from posthog-node and pay zero bundle cost
// when the env isn't configured.
interface PHClient {
  capture(args: {
    distinctId: string;
    event: string;
    properties?: Record<string, unknown>;
    groups?: Record<string, string>;
  }): void;
  identify?(args: { distinctId: string; properties?: Record<string, unknown> }): void;
  groupIdentify?(args: {
    groupType: string;
    groupKey: string;
    properties?: Record<string, unknown>;
  }): void;
  shutdown(): Promise<void>;
}

let cachedClient: PHClient | null = null;
let initFailed = false;

async function getClient(): Promise<PHClient | null> {
  if (initFailed) return null;
  if (cachedClient) return cachedClient;
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) return null;
  try {
    const { PostHog } = await import("posthog-node");
    cachedClient = new PostHog(apiKey, {
      host: process.env.POSTHOG_HOST ?? "https://eu.i.posthog.com",
      // flushAt: 1 — every capture call sends immediately. Slightly
      // chattier with PostHog than batched flushing, but reliable on
      // serverless where the worker can be reaped at any time.
      flushAt: 1,
      flushInterval: 0,
    }) as unknown as PHClient;
    return cachedClient;
  } catch (e) {
    initFailed = true;
    console.error("[posthog] failed to initialize:", (e as Error).message);
    return null;
  }
}

export type EventName =
  // Auth
  | "signup_completed"
  | "login_completed"
  | "password_reset_requested"
  | "password_reset_completed"
  // Document analysis
  | "analysis_completed"
  | "analysis_failed"
  | "ocr_used"
  // Document generation
  | "document_generated"
  | "document_refined"
  | "document_version_created"
  | "document_version_reverted"
  // Chat
  | "chat_message_sent"
  // Counterparty
  | "counterparty_checked"
  // Workspaces
  | "workspace_created"
  | "workspace_switched"
  | "member_invited"
  | "invite_accepted"
  | "trial_activated_manually"
  // Billing
  | "checkout_started"
  | "payment_succeeded"
  | "payment_failed"
  | "subscription_canceled"
  // Admin
  | "admin_action_performed";

interface CaptureArgs {
  /** User cuid. Use "anonymous" for anonymous flows. */
  userId: string | null;
  event: EventName;
  /** Event properties — strictly no PII. orgId, plan, feature, etc. */
  properties?: Record<string, unknown>;
  /** Org cuid for PostHog group analytics ("workspace" group). */
  orgId?: string | null;
}

/**
 * Capture an analytics event. Never throws, never blocks the response —
 * the call returns a fire-and-forget Promise that is OK to drop.
 */
export async function captureEvent(args: CaptureArgs): Promise<void> {
  try {
    const client = await getClient();
    if (!client) return;
    client.capture({
      distinctId: args.userId ?? "anonymous",
      event: args.event,
      properties: {
        ...args.properties,
        $source: "server",
      },
      groups: args.orgId ? { workspace: args.orgId } : undefined,
    });
  } catch (e) {
    // Reporting tells us when analytics breaks without breaking the app.
    await reportError(e, { op: "analytics.capture", tags: { event: args.event } });
  }
}

/**
 * Identify a user with metadata so PostHog can resolve their distinctId
 * across sessions. Only opaque ids — never email/name (those leak through
 * PostHog's "person profile" view to anyone with PostHog access).
 */
export async function identifyUser(
  userId: string,
  properties: Record<string, unknown>
): Promise<void> {
  try {
    const client = await getClient();
    if (!client?.identify) return;
    client.identify({ distinctId: userId, properties });
  } catch (e) {
    await reportError(e, { op: "analytics.identify" });
  }
}

/**
 * Identify a workspace ("group" in PostHog parlance) — same idea as
 * identifyUser but at the org level. Lets PostHog show "all users in
 * Acme Corp's workspace" as a cohort.
 */
export async function identifyWorkspace(
  orgId: string,
  properties: Record<string, unknown>
): Promise<void> {
  try {
    const client = await getClient();
    if (!client?.groupIdentify) return;
    client.groupIdentify({
      groupType: "workspace",
      groupKey: orgId,
      properties,
    });
  } catch (e) {
    await reportError(e, { op: "analytics.groupIdentify" });
  }
}

/** True iff PostHog is configured — useful for skipping work when off. */
export function isAnalyticsEnabled(): boolean {
  return !!process.env.POSTHOG_API_KEY;
}
