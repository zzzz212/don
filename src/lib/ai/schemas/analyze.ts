import { z } from "zod";

export const RiskLevelSchema = z.enum(["critical", "medium", "low"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

// Final binary recommendation. Three states because "negotiate" is a
// real outcome lawyers offer that's distinct from both poles — UI shows
// a different colour and wording for each.
export const VerdictSchema = z.enum(["sign", "negotiate", "do_not_sign"]);
export type Verdict = z.infer<typeof VerdictSchema>;

// Counter-AI: what the other side of the contract gains from a risky
// clause, and an optional compromise wording. One-sided inference in
// Sprint 14 — the AI simulates the other party; real two-sided input
// lands in Sprint 17+. Both fields are stored as JSON on DealClause so
// they survive even if analyze schema changes later.
export const CounterPerspectiveSchema = z.object({
  theirGain: z.string(),
  compromise: z.string().optional(),
});
export type CounterPerspective = z.infer<typeof CounterPerspectiveSchema>;

export const AnalysisRiskSchema = z.object({
  clauseNumber: z.string(),
  clauseTitle: z.string(),
  level: RiskLevelSchema,
  description: z.string(),
  // Practical fallout: what the client concretely stands to lose —
  // money, time, rights — if the clause is signed as-is. Optional so a
  // model omission never fails the whole analysis, and so analyses
  // persisted before this field existed still parse cleanly.
  consequence: z.string().optional(),
  legalReference: z.string(),
  originalText: z.string(),
  recommendedText: z.string(),
  recommendation: z.string(),
  // Counter-AI (Sprint 14). Optional so analyses persisted before this
  // field existed still parse cleanly — same back-compat treatment as
  // `consequence`.
  counterPerspective: CounterPerspectiveSchema.optional(),
});

export const NotarizationSchema = z.object({
  required: z.boolean(),
  reason: z.string(),
});

export const RegistrationSchema = z.object({
  required: z.boolean(),
  reason: z.string(),
});

// Side-balance assessment — whose interests the contract leans toward.
// `favor` drives UI colour ("balanced" is good; "first"/"second" flag a
// tilt); `comment` names the favoured role and the clauses behind it.
export const BalanceSchema = z.object({
  favor: z.enum(["balanced", "first", "second"]),
  comment: z.string(),
});

export const AnalysisResultSchema = z.object({
  // `coerce` converts a quoted number like "8" → 8 before validation.
  // Anthropic occasionally serialises numeric JSON values as strings
  // under high-token-pressure prompts; without coerce, that single
  // wrinkle nukes the entire analysis even though the model "got it
  // right" semantically. The generated JSON schema stays `{type: "number"}`
  // so Gemini path is unaffected (foot-gun #42).
  score: z.coerce.number().int().min(1).max(10),
  summary: z.string(),
  contractType: z.string(),
  parties: z.string(),
  // Direct, unambiguous final answer the user is actually looking for.
  // The prompt's calibration table maps risk pattern → verdict → score
  // band so the three signals never disagree.
  verdict: VerdictSchema,
  verdictReason: z.string(),
  // Whose side the contract favours. Optional so a model omission never
  // fails the analysis and analyses persisted before this field existed
  // still parse cleanly.
  balance: BalanceSchema.optional(),
  risks: z.array(AnalysisRiskSchema),
  notarization: NotarizationSchema,
  registration: RegistrationSchema,
  missingClauses: z.array(z.string()),
  preSigningChecklist: z.array(z.string()),
});

export type AnalysisRisk = z.infer<typeof AnalysisRiskSchema>;
export type NotarizationInfo = z.infer<typeof NotarizationSchema>;
export type RegistrationInfo = z.infer<typeof RegistrationSchema>;
export type Balance = z.infer<typeof BalanceSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema> & {
  isDemo?: boolean;
};
