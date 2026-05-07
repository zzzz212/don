import { z } from "zod";
import { AnalysisRiskSchema } from "./analyze";

export const ChunkRisksSchema = z.object({
  risks: z.array(AnalysisRiskSchema),
});

export type ChunkRisks = z.infer<typeof ChunkRisksSchema>;

// Synthesis takes the risks already collected from chunks plus the document
// preamble, and fills in the structural fields (type, parties, registration,
// etc). The risks themselves are produced by the map step and not re-asked
// here — synthesis must not invent new ones.
export const SynthesisSchema = z.object({
  score: z.number().int().min(1).max(10),
  summary: z.string(),
  contractType: z.string(),
  parties: z.string(),
  notarization: z.object({
    required: z.boolean(),
    reason: z.string(),
  }),
  registration: z.object({
    required: z.boolean(),
    reason: z.string(),
  }),
  missingClauses: z.array(z.string()),
  preSigningChecklist: z.array(z.string()),
});

export type Synthesis = z.infer<typeof SynthesisSchema>;
