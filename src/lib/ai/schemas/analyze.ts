import { z } from "zod";

export const RiskLevelSchema = z.enum(["critical", "medium", "low"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

// Final binary recommendation. Three states because "negotiate" is a
// real outcome lawyers offer that's distinct from both poles — UI shows
// a different colour and wording for each.
export const VerdictSchema = z.enum(["sign", "negotiate", "do_not_sign"]);
export type Verdict = z.infer<typeof VerdictSchema>;

export const AnalysisRiskSchema = z.object({
  clauseNumber: z.string(),
  clauseTitle: z.string(),
  level: RiskLevelSchema,
  description: z.string(),
  legalReference: z.string(),
  originalText: z.string(),
  recommendedText: z.string(),
  recommendation: z.string(),
});

export const NotarizationSchema = z.object({
  required: z.boolean(),
  reason: z.string(),
});

export const RegistrationSchema = z.object({
  required: z.boolean(),
  reason: z.string(),
});

export const AnalysisResultSchema = z.object({
  score: z.number().int().min(1).max(10),
  summary: z.string(),
  contractType: z.string(),
  parties: z.string(),
  // Direct, unambiguous final answer the user is actually looking for.
  // The prompt's calibration table maps risk pattern → verdict → score
  // band so the three signals never disagree.
  verdict: VerdictSchema,
  verdictReason: z.string(),
  risks: z.array(AnalysisRiskSchema),
  notarization: NotarizationSchema,
  registration: RegistrationSchema,
  missingClauses: z.array(z.string()),
  preSigningChecklist: z.array(z.string()),
});

export type AnalysisRisk = z.infer<typeof AnalysisRiskSchema>;
export type NotarizationInfo = z.infer<typeof NotarizationSchema>;
export type RegistrationInfo = z.infer<typeof RegistrationSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema> & {
  isDemo?: boolean;
};
