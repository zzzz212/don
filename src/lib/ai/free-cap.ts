// Shared FREE-tier daily cap for the negotiation suggest-moves feature.
//
// Both the sender route (.../deals/[id]/.../suggest-moves) and the
// receiver route (.../deals/by-token/[token]/.../suggest-moves) gate on
// this before calling generate(). Keeping the threshold and the decision
// in one place means the two routes can't silently diverge — the receiver
// path used to skip the cap entirely, which let an anonymous receiver run
// unmetered Anthropic spend against the deal owner's plan (foot-gun #60).
//
// Negotiation moves run on the "chat" tier, so they count against the
// owner's FREE chat-feature usage (AiUsage rows with feature="chat" in a
// rolling 24h window). The DB count itself lives in the route (src/app is
// excluded from vitest); this module owns only the pure threshold decision
// so it can be unit-tested.

import { normalizePlan } from "@/lib/plans";

/** Max negotiation suggest-moves a FREE owner may trigger per rolling 24h. */
export const FREE_CHAT_CAP = 10;

/**
 * True when an owner on the FREE tier has hit or exceeded the daily cap and
 * must be refused (HTTP 402). Paid tiers are never capped. Unknown / missing
 * plan codes fail closed — they resolve to FREE rather than granting an
 * uncapped free pass (mirrors pickTier's "never silently spend" stance).
 *
 * `?force=1` is a cache-bypass only (foot-gun #59) — callers MUST evaluate
 * this regardless of force.
 */
export function isOverFreeChatCap(
  plan: string | null | undefined,
  used: number
): boolean {
  if (normalizePlan(plan) !== "FREE") return false;
  return used >= FREE_CHAT_CAP;
}
