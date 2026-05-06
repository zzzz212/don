import { generate, getActiveProvider } from "./client";
import { ANALYZE_CONTRACT_SYSTEM } from "./prompts";
import { AnalysisResultSchema, type AnalysisResult } from "./schemas/analyze";
import { generateDemoAnalysis } from "./providers/demo";
import { logUsage } from "./usage";

export type {
  AnalysisRisk,
  AnalysisResult,
  NotarizationInfo,
  RegistrationInfo,
} from "./schemas/analyze";

export async function analyzeContract(
  contractText: string,
  userId: string | null = null
): Promise<AnalysisResult> {
  if (getActiveProvider() === "demo") {
    return generateDemoAnalysis(contractText);
  }

  const result = await generate({
    schema: AnalysisResultSchema,
    system: ANALYZE_CONTRACT_SYSTEM,
    prompt: `Проанализируй следующий договор и найди все юридические риски:\n\n${contractText}`,
    model: "smart",
    maxTokens: 4096,
    temperature: 0.1,
  });

  await logUsage(userId, result.usage, "analyze");

  return result.data;
}
