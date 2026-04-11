import Anthropic from "@anthropic-ai/sdk";
import { ANALYZE_CONTRACT_SYSTEM_PROMPT } from "./prompts";

export interface AnalysisRisk {
  clause: string;
  level: "critical" | "medium" | "low";
  description: string;
  recommendation: string;
}

export interface AnalysisResult {
  score: number;
  summary: string;
  risks: AnalysisRisk[];
}

export async function analyzeContract(
  contractText: string
): Promise<AnalysisResult> {
  const client = new Anthropic();

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: ANALYZE_CONTRACT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Проанализируй следующий договор и найди все юридические риски:\n\n${contractText}`,
      },
    ],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";

  const result: AnalysisResult = JSON.parse(responseText);

  return result;
}
