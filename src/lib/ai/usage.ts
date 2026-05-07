import { prisma } from "@/lib/db";
import type { Usage } from "./types";
import type { OcrResult } from "@/lib/ocr/types";

export type AiFeature = "analyze" | "chat" | "generate" | "ocr";

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

/**
 * Log an OCR call. Tokens are mapped from page count (Yandex bills per page,
 * not per token). outputTokens stays 0 — OCR doesn't generate tokens, it
 * extracts them. This keeps a single AiUsage table for both AI and OCR with
 * a uniform `feature` query.
 */
export async function logOcrUsage(
  userId: string | null | undefined,
  result: OcrResult,
  textLength: number
): Promise<void> {
  if (!userId) return;
  try {
    await prisma.aiUsage.create({
      data: {
        userId,
        feature: "ocr",
        provider: result.provider,
        model: "ocr-page",
        inputTokens: result.pageCount,
        outputTokens: textLength,
        cachedTokens: 0,
        latencyMs: result.latencyMs,
      },
    });
  } catch (error) {
    console.error("Failed to log OCR usage:", error);
  }
}
