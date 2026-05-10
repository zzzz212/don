import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { reportError } from "@/lib/telemetry";
import { verifyTotpCode, generateRecoveryCodes } from "@/lib/totp";
import { logAudit, attribution } from "@/lib/audit";

// POST /api/account/2fa/verify  { code: "123456" }
//
// Confirm enrollment. The user just scanned the QR + saw a 6-digit code
// in their authenticator app and entered it here. We verify against the
// pending secret, flip enabledAt, and return 10 freshly-generated
// recovery codes (plaintext — shown to the user ONCE, hashes stored).
//
// The recovery codes are returned in the response body and never logged
// or stored as plaintext. The frontend must present them prominently
// and let the user download / copy them.

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
    };
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!code) {
      return NextResponse.json(
        { error: "Введите 6-значный код из приложения" },
        { status: 400 }
      );
    }

    const cred = await prisma.totpCredential.findUnique({
      where: { userId },
    });
    if (!cred) {
      return NextResponse.json(
        {
          error: "2FA не настроена. Начните с шага «Настроить».",
          code: "NOT_SETUP",
        },
        { status: 400 }
      );
    }
    if (cred.enabledAt) {
      return NextResponse.json(
        { error: "2FA уже подтверждена.", code: "ALREADY_ENABLED" },
        { status: 409 }
      );
    }

    if (!verifyTotpCode(code, cred.secret)) {
      return NextResponse.json(
        {
          error:
            "Код не подходит. Проверьте, что время на устройстве синхронизировано, и попробуйте ещё раз.",
        },
        { status: 400 }
      );
    }

    // Successful verification — generate recovery codes, persist hashes,
    // flip enabledAt. All in one transaction so the row is never in a
    // half-enabled state.
    const recovery = generateRecoveryCodes();
    await prisma.totpCredential.update({
      where: { userId },
      data: {
        enabledAt: new Date(),
        recoveryCodes: recovery.hashed,
      },
    });

    void logAudit({
      orgId: session.user.activeOrgId ?? null,
      userId,
      action: "auth.2fa_enabled",
      target: userId,
      targetType: "user",
      ...attribution(request),
    });

    return NextResponse.json({
      ok: true,
      recoveryCodes: recovery.plaintext,
      enabledAt: new Date().toISOString(),
    });
  } catch (error) {
    await reportError(error, { op: "account.2fa.verify" });
    return NextResponse.json(
      { error: "Не удалось подтвердить 2FA" },
      { status: 500 }
    );
  }
}
