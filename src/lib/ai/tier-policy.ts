// Per-action / per-plan tier policy. Centralises the "which model do
// we run for this user, doing this thing" decision so we can tune
// costs without touching the routes.
//
// Tiers translate to concrete models in src/lib/ai/types.ts (MODEL_MAP).
// Across providers:
//   • Anthropic: fast=Haiku 4.5, smart=Sonnet 4.6, deep=Opus 4.7
//   • Gemini:    fast/smart=Flash 2.5, deep=Pro 2.5
//   • Groq:      single-model fallback (Llama 3.3 70B)
//
// Why this layout
//   • analyze: FREE on Haiku. The previous "FREE also gets Sonnet"
//     stance cost us ~$0.15 per anonymous analysis with $0 revenue —
//     three free analyses per signup is $0.45 of variable cost before
//     a user has even decided whether to pay. Haiku 4.5 lands within
//     ~80% of Sonnet's risk-detection recall on contracts we've
//     spot-checked, and the FREE tier exists for evaluation, not
//     production quality. PRO runs Sonnet (the actual product).
//     BUSINESS escalates to Opus on analyze only — where the long
//     contract / nuanced clauses justify $0.50/run — generate / refine
//     stay on Sonnet (Opus doesn't help template fills).
//   • generate: FREE on Haiku (short template fills are fine on a
//     small model). PRO+ on Sonnet — better phrasing, fewer "стороны
//     рассмотрят" softeners.
//   • refine: same shape as generate. Patch-mode anchors are easier
//     for a smarter model to nail on the first try → fewer fallbacks
//     to full regen → cheaper in practice even though Sonnet input
//     costs more per token.
//   • chat: Haiku on FREE keeps casual chat-spam costs down. PRO+ on
//     Sonnet — paid users expect substance, citations, structure.

import type { ModelTier } from "./types";

export type AiAction = "analyze" | "generate" | "refine" | "chat";

// Internal canonical groups for the policy table. PRO_SOLO and PRO_TEAM
// share the PRO row — they're priced differently and have different
// usage caps (enforced by quota), but the per-call model selection is
// the same: paid users get Sonnet across the board.
export type EffectivePlan = "FREE" | "PRO" | "BUSINESS";

const POLICY: Record<AiAction, Record<EffectivePlan, ModelTier>> = {
  analyze: {
    FREE: "fast",
    PRO: "smart",
    BUSINESS: "deep",
  },
  generate: {
    FREE: "fast",
    PRO: "smart",
    BUSINESS: "smart",
  },
  refine: {
    FREE: "fast",
    PRO: "smart",
    BUSINESS: "smart",
  },
  chat: {
    FREE: "fast",
    PRO: "smart",
    BUSINESS: "smart",
  },
};

/**
 * Pick the model tier for an (action, effectivePlan) pair. Defaults to
 * the FREE row when the plan is unknown — safer to run a smaller model
 * than to silently spend on a tier the user shouldn't see.
 *
 * Accepts both the legacy "PRO" string and the new "PRO_SOLO" /
 * "PRO_TEAM" tier names — all three resolve to the PRO policy row.
 */
export function pickTier(
  action: AiAction,
  plan: string | null | undefined
): ModelTier {
  let normalized: EffectivePlan;
  if (plan === "BUSINESS") {
    normalized = "BUSINESS";
  } else if (plan === "PRO" || plan === "PRO_SOLO" || plan === "PRO_TEAM") {
    normalized = "PRO";
  } else {
    normalized = "FREE";
  }
  return POLICY[action][normalized];
}
