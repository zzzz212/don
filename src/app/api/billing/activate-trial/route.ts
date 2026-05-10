import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  ensureActiveOrg,
  requireMembership,
  OrgAccessError,
} from "@/lib/org";
import { activateTrial } from "@/lib/billing/trial";
import { reportError } from "@/lib/telemetry";
import { captureEvent } from "@/lib/analytics/server";

// POST /api/billing/activate-trial
//   Manually claim the trial — only for legacy accounts that existed
//   before the trial feature shipped, where ensureActiveOrg's bootstrap
//   branch never re-fired. Idempotent + single-use: User.trialActivatedAt
//   gates re-claims forever after.
//
//   OWNER-only: trial activation flips the workspace's effective plan,
//   which is a workspace-level decision.
export async function POST() {
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

    const result = await activateTrial(userId, orgId);
    if (!result.ok) {
      // Map internal failure reasons to user-facing copy.
      const map: Record<string, { msg: string; code: number }> = {
        ALREADY_ACTIVATED: {
          msg: "Пробный период уже был активирован для этого аккаунта.",
          code: 409,
        },
        WORKSPACE_NOT_FREE: {
          msg: "Пробный период доступен только для бесплатного workspace без активного триала или подписки.",
          code: 409,
        },
        WORKSPACE_NOT_FOUND: {
          msg: "Workspace не найден.",
          code: 404,
        },
        USER_NOT_FOUND: {
          msg: "Аккаунт не найден.",
          code: 404,
        },
      };
      const m = map[result.reason ?? ""] ?? {
        msg: "Не удалось активировать пробный период.",
        code: 400,
      };
      return NextResponse.json({ error: m.msg }, { status: m.code });
    }

    void captureEvent({
      userId,
      orgId,
      event: "trial_activated_manually",
      properties: { trialEndsAt: result.trialEndsAt ?? null },
    });

    return NextResponse.json({
      ok: true,
      trialEndsAt: result.trialEndsAt,
    });
  } catch (error) {
    if (error instanceof OrgAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    await reportError(error, { op: "billing.activate-trial" });
    return NextResponse.json(
      { error: "Не удалось активировать пробный период. Попробуйте позже." },
      { status: 500 }
    );
  }
}
