import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkQuota } from "@/lib/quota";
import type { QuotaFeature } from "@/lib/plans";

const FEATURES: QuotaFeature[] = ["analyze", "generate", "chat"];

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json(
      { error: "Требуется авторизация" },
      { status: 401 }
    );
  }

  try {
    const statuses = await Promise.all(
      FEATURES.map((f) => checkQuota(userId, f))
    );

    return NextResponse.json({
      plan: statuses[0]?.plan ?? "FREE",
      resetsAt: statuses[0]?.resetsAt.toISOString(),
      features: statuses.reduce<Record<string, unknown>>((acc, s) => {
        acc[s.feature] = {
          used: s.used,
          limit: s.unlimited ? null : s.limit,
          unlimited: s.unlimited,
          remaining: s.unlimited ? null : Math.max(0, s.limit - s.used),
        };
        return acc;
      }, {}),
    });
  } catch (error) {
    console.error("Usage fetch error:", error);
    return NextResponse.json(
      { error: "Не удалось получить статистику использования" },
      { status: 500 }
    );
  }
}
