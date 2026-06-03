import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  ensureActiveOrg,
  requireMembership,
  OrgAccessError,
} from "@/lib/org";
import {
  cancelSubscriptionAtPeriodEnd,
  resumeSubscription,
} from "@/lib/billing";
import { reportError } from "@/lib/telemetry";
import { captureEvent } from "@/lib/analytics/server";
import { logAudit } from "@/lib/audit";

// POST /api/billing/cancel
//   Self-serve cancel-at-period-end (and resume) for the workspace's
//   subscription. OWNER-only — cancelling flips the effective plan once
//   the period ends, a workspace-level decision. No provider call: there
//   is no recurring charge to stop yet (auto-renew deferred, roadmap
//   §MON-3), we only set Subscription.cancelAtPeriodEnd so the future
//   renewal loop skips this seat.
//
//   Body: { resume?: boolean }. resume=true clears a scheduled cancel.
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Требуется авторизация" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const orgId = session.user.activeOrgId ?? (await ensureActiveOrg(userId));
    await requireMembership(userId, orgId, "OWNER");

    const body = (await request.json().catch(() => ({}))) as {
      resume?: boolean;
    };

    if (body.resume === true) {
      const r = await resumeSubscription(orgId);
      if (!r.ok) {
        return NextResponse.json(
          { error: "Нет подписки, запланированной к отмене." },
          { status: 409 }
        );
      }
      void logAudit({
        orgId,
        userId,
        action: "billing.subscription_canceled",
        target: orgId,
        targetType: "subscription",
        payload: { resumed: true },
      });
      return NextResponse.json({ ok: true, cancelAtPeriodEnd: false });
    }

    const result = await cancelSubscriptionAtPeriodEnd(orgId);
    if (!result.ok) {
      const map: Record<string, { msg: string; code: number }> = {
        NO_SUBSCRIPTION: {
          msg: "Нет активной подписки для отмены.",
          code: 409,
        },
        ALREADY_SCHEDULED: {
          msg: "Подписка уже запланирована к отмене в конце периода.",
          code: 409,
        },
        NOT_ACTIVE: {
          msg: "Подписка не активна.",
          code: 409,
        },
      };
      const m = map[result.reason] ?? {
        msg: "Не удалось отменить подписку.",
        code: 400,
      };
      return NextResponse.json({ error: m.msg }, { status: m.code });
    }

    // EventName union has no "scheduled" variant — reuse the existing
    // subscription_canceled event (the cancel was just scheduled here).
    void captureEvent({
      userId,
      orgId,
      event: "subscription_canceled",
      properties: { currentPeriodEnd: result.currentPeriodEnd },
    });
    void logAudit({
      orgId,
      userId,
      action: "billing.subscription_canceled",
      target: orgId,
      targetType: "subscription",
      // No PII here — only the schedule fact + the period boundary.
      payload: {
        cancelAtPeriodEnd: true,
        currentPeriodEnd: result.currentPeriodEnd,
      },
    });

    return NextResponse.json({
      ok: true,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: result.currentPeriodEnd,
    });
  } catch (error) {
    if (error instanceof OrgAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    await reportError(error, { op: "billing.cancel" });
    return NextResponse.json(
      { error: "Не удалось отменить подписку. Попробуйте позже." },
      { status: 500 }
    );
  }
}
