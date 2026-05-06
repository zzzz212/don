import { prisma } from "@/lib/db";
import type { Usage } from "./types";

export type AiFeature = "analyze" | "chat" | "generate";

export async function logUsage(
  userId: string | null | undefined,
  usage: Usage,
  feature: AiFeature
): Promise<void> {
  if (!userId) return;
  try {
    await prisma.aiUsage.create({
      data: {
        userId,
        feature,
        provider: usage.provider,
        model: usage.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cachedTokens: usage.cachedInputTokens,
        latencyMs: usage.latencyMs,
      },
    });
  } catch (error) {
    console.error("Failed to log AI usage:", error);
  }
}
