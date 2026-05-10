import { z } from "zod";

export const RiskLevelSchema = z.enum(["critical", "medium", "low"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

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
