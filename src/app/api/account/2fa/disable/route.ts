import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { reportError } from "@/lib/telemetry";
import {
  verifyTotpCode,
  consumeRecoveryCode,
} from "@/lib/totp";
import { logAudit, attribution } from "@/lib/audit";

// POST /api/account/2fa/disable  { code?: string, password?: string, recoveryCode?: string }
//
// Turn 2FA off. Three accepted proofs (any one works):
//   1. `code` — current TOTP from the authenticator app. Most common.
//   2. `password` — for users who registered via credentials. Bcrypt
//      compared.
//   3. `recoveryCode` — single-use; matched + removed from the list.
//
// We require ONE of the three even though the user is already logged
// in: 2FA disable is a security-sensitive action and reauth-on-action
// matches industry standard (GitHub, Google).

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Требуется авторизация" },
        { status: 401 }
      );
    }
    const userId = session.user.id;

    const body = (await request.json().catch(() => ({}))) as {
      code?: unknown;
      password?: unknown;
      recoveryCode?: unknown;
    };
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const password =
      typeof body.password === "string" ? body.password : "";
    const recoveryCode =
      typeof body.recoveryCode === "string" ? body.recoveryCode.trim() : "";

    if (!code && !password && !recoveryCode) {
      return NextResponse.json(
        {
          error:
            "Подтвердите действие: введите 6-значный код, пароль или код восстановления.",
        },
        { status: 400 }
      );
    }

    const cred = await prisma.totpCredential.findUnique({
      where: { userId },
    });
    if (!cred?.enabledAt) {
      return NextResponse.json(
        { error: "2FA не включена" },
        { status: 400 }
      );
    }

    let proofValid = false;
    let proofKind: "totp" | "password" | "recovery" | null = null;

    if (code) {
      proofValid = verifyTotpCode(code, cred.secret);
      proofKind = "totp";
    } else if (recoveryCode) {
      const remaining = consumeRecoveryCode(recoveryCode, cred.recoveryCodes);
      if (remaining !== null) {
        // Update the row even though we're about to delete it — keeps
        // the audit trail consistent if the delete fails for any
        // reason.
        await prisma.totpCredential.update({
          where: { userId },
          data: { recoveryCodes: remaining },
        });
        proofValid = true;
        proofKind = "recovery";
      }
    } else if (password) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { password: true },
      });
      if (user?.password) {
        proofValid = await bcrypt.compare(password, user.password);
      }
      proofKind = "password";
    }

    if (!proofValid) {
      return NextResponse.json(
        { error: "Подтверждение не прошло. Проверьте введённые данные." },
        { status: 400 }
      );
    }

    await prisma.totpCredential.delete({ where: { userId } });

    void logAudit({
      orgId: session.user.activeOrgId ?? null,
      userId,
      action: "auth.2fa_disabled",
      target: userId,
      targetType: "user",
      payload: { proofKind },
      ...attribution(request),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    await reportError(error, { op: "account.2fa.disable" });
    return NextResponse.json(
      { error: "Не удалось отключить 2FA" },
      { status: 500 }
    );
  }
}
