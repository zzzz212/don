// Pure core for DR-2 viral-funnel instrumentation. Keeping the event
// names and the distinctId resolver here (not in route handlers) lets us
// unit-test them — `src/app/**` is excluded from vitest. The routes are
// thin glue that call captureEvent with these values.

import type { EventName } from "./server";

/**
 * The six funnel stages, invite → open → engage → AGREED. Values are the
 * exact PostHog event strings; they are a subset of the closed EventName
 * union in server.ts, so a typo here is a compile error.
 */
export const DEAL_FUNNEL_EVENTS = {
  dealCreated: "deal_created",
  dealLinkOpened: "deal_link_opened",
  receiverIdentified: "receiver_identified",
  clauseAgreed: "clause_agreed",
  clauseDisputed: "clause_disputed",
  dealAgreedComplete: "deal_agreed_complete",
} as const satisfies Record<string, EventName>;

/**
 * Map a reconciled clause status to its funnel event. Only AGREED and
 * DISPUTED are funnel-meaningful; PENDING (no decision yet) and RESOLVED
 * (a future DR-3 terminal state) emit nothing.
 */
export function clauseEventFor(
  status: string
): "clause_agreed" | "clause_disputed" | null {
  if (status === "AGREED") return DEAL_FUNNEL_EVENTS.clauseAgreed;
  if (status === "DISPUTED") return DEAL_FUNNEL_EVENTS.clauseDisputed;
  return null;
}

/**
 * Resolve the PostHog distinctId for a deal-funnel event. Owner cuid wins
 * (sender / authenticated owner path); the anonymous receiver's opaque
 * session id is the fallback; "anonymous" is the last resort. Both inputs
 * are opaque ids by construction — this resolver must never be handed an
 * email or name (foot-gun: distinctId must be PII-free, never null+PII).
 */
export function dealFunnelDistinctId(args: {
  ownerId: string | null;
  sessionId: string | null;
}): string {
  return args.ownerId ?? args.sessionId ?? "anonymous";
}
