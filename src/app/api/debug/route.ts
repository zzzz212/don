import { NextResponse } from "next/server";
import { getActiveProvider } from "@/lib/ai/client";

export async function GET() {
  const provider = getActiveProvider();
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  const geminiKeyPrefix = process.env.GEMINI_API_KEY?.slice(0, 8) || "not set";

  return NextResponse.json({
    provider,
    hasGeminiKey,
    geminiKeyPrefix,
    envFiles: "check server console for details",
  });
}
