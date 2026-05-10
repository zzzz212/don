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
//   • analyze: PRO and FREE both run Sonnet — analysis quality is the
//     core sales pitch and Haiku misses citations on long contracts.
//     BUSINESS escalates to Opus only on the analyze step (where the
//     extra cost is justified) — generate / refine stay on Sonnet.
//   • generate: FREE on Haiku for cost reasons (template + form fill
//     fits Haiku fine for short contracts). PRO+ on Sonnet — better
//     phrasing, fewer "стороны рассмотрят" softeners.
//   • refine: same shape as generate. Patch-mode anchors are easier
//     for a smarter model to nail on the first try → fewer fallbacks
//     to full regen → cheaper in practice even though Sonnet input
//     costs more per token.
//   • chat: Haiku on FREE keeps casual chat-spam costs down. PRO+ on
//     Sonnet — paid users expect substance, citations, structure.

import type { ModelTier } from "./types";

export type AiAction = "analyze" | "generate" | "refine" | "chat";

export type EffectivePlan = "FREE" | "PRO" | "BUSINESS";

const POLICY: Record<AiAction, Record<EffectivePlan, ModelTier>> = {
  analyze: {
    FREE: "smart",
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
 */
export function pickTier(
  action: AiAction,
  plan: string | null | undefined
): ModelTier {
  const normalized: EffectivePlan =
    plan === "PRO" || plan === "BUSINESS" ? plan : "FREE";
  return POLICY[action][normalized];
}
