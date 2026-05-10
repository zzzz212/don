import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireAdmin, AdminAccessError } from "@/lib/admin";
import { reportError } from "@/lib/telemetry";
import { TRIAL_DAYS } from "@/lib/legal-info";

// POST /api/admin/users/[id]/extend-trial  { orgId, days?: number }
//
// Pushes Organization.trialEndsAt forward by N days (default
// TRIAL_DAYS = 7) for the user's chosen workspace. Also flips
// User.trialActivatedAt to a fresh timestamp so subsequent eligibility
// checks see this as a granted trial — the audit trail in
// support@ tickets reads cleaner.
//
// Use cases:
//   • Customer paid but their card was declined; extend trial while
//     they re-add the card.
//   • Onboarded prospect needs another week before purchase decision.
//   • Bug in our system caused premature trial expiry.

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_DAYS = 60; // Hard cap so a typo doesn't grant a year of free PRO.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    requireAdmin(session?.user?.id);

    const { id: userId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      orgId?: unknown;
      days?: unknown;
    };
    const orgId = typeof body.orgId === "string" ? body.orgId : "";
    const days =
      typeof body.days === "number" && body.days > 0 && body.days <= MAX_DAYS
        ? Math.floor(body.days)
        : TRIAL_DAYS;

    if (!orgId) {
      return NextResponse.json(
        { error: "orgId обязателен" },
        { status: 400 }
      );
    }

    // Verify the user owns the workspace — extending trial on someone
    // else's org would be a data-integrity bug.
    const ownership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId } },
      select: { role: true },
    });
    if (!ownership || ownership.role !== "OWNER") {
      return NextResponse.json(
        { error: "Пользователь не является владельцем этого workspace" },
        { status: 400 }
      );
    }

    const now = new Date();
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { trialEndsAt: true, plan: true },
    });
    if (!org) {
      return NextResponse.json(
        { error: "Workspace не найден" },
        { status: 404 }
      );
    }

    // If a trial is still running, push the existing end date forward.
    // If it's expired (or never granted), start a fresh window from now.
    const newTrialEndsAt = new Date(
      org.trialEndsAt && org.trialEndsAt.getTime() > now.getTime()
        ? org.trialEndsAt.getTime() + days * MS_PER_DAY
        : now.getTime() + days * MS_PER_DAY
    );

    await prisma.$transaction([
      prisma.organization.update({
        where: { id: orgId },
        data: { trialEndsAt: newTrialEndsAt },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { trialActivatedAt: now },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      trialEndsAt: newTrialEndsAt.toISOString(),
      daysAdded: days,
    });
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    await reportError(error, { op: "admin.users.extend-trial" });
    return NextResponse.json(
      { error: "Не удалось продлить триал" },
      { status: 500 }
    );
  }
}
