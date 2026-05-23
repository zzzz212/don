import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkQuota } from "@/lib/quota";
import { ensureActiveOrg } from "@/lib/org";
import type { QuotaFeature } from "@/lib/plans";

const FEATURES: QuotaFeature[] = ["analyze", "generate", "chat", "ocr"];

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
    // session.user.activeOrgId is set by the JWT callback, but fall back to
    // ensureActiveOrg as a safety net for edge cases (stale JWT, etc.).
    const orgId = session.user.activeOrgId ?? (await ensureActiveOrg(userId));

    const statuses = await Promise.all(
      FEATURES.map((f) => checkQuota(orgId, f))
    );

    const head = statuses[0];
    return NextResponse.json({
      plan: head?.plan ?? "FREE",
      isTrial: head?.isTrial ?? false,
      trialDaysLeft: head?.trialDaysLeft ?? null,
      orgId,
      resetsAt: head?.resetsAt.toISOString(),
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
