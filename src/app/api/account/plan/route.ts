import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEffectiveUserPlan } from "@/lib/plans";
import { reportError } from "@/lib/telemetry";

// GET /api/account/plan
//   Lightweight, user-scoped plan probe. Unlike /api/billing/status
//   (which requires OWNER membership on the active workspace), this
//   one reads only User.plan / User.trialEndsAt — every authenticated
//   user can see their own plan, including a MEMBER who's currently
//   sitting in someone else's workspace.
//
//   Used by the AccountMenu trial chip.
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
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, trialEndsAt: true },
    });

    const effective = getEffectiveUserPlan({
      plan: user?.plan,
      trialEndsAt: user?.trialEndsAt ?? null,
    });

    return NextResponse.json({
      plan: effective.plan,
      baselinePlan: effective.baselinePlan,
      isTrial: effective.isTrial,
      trialEndsAt: effective.trialEndsAt
        ? effective.trialEndsAt.toISOString()
        : null,
      trialDaysLeft: effective.trialDaysLeft,
    });
  } catch (error) {
    await reportError(error, { op: "account.plan", userId });
    return NextResponse.json(
      { error: "Не удалось загрузить план" },
      { status: 500 }
    );
  }
}
