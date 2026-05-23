import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { reportError } from "@/lib/telemetry";

// GET /api/account/2fa/status
//   Quick read for the /account/security page — is 2FA on, when was it
//   enabled, how many recovery codes are left.

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Требуется авторизация" },
        { status: 401 }
      );
    }
    const cred = await prisma.totpCredential.findUnique({
      where: { userId: session.user.id },
      select: { enabledAt: true, recoveryCodes: true },
    });
    return NextResponse.json({
      enabled: !!cred?.enabledAt,
      enabledAt: cred?.enabledAt?.toISOString() ?? null,
      recoveryCodesRemaining: cred?.recoveryCodes.length ?? 0,
    });
  } catch (error) {
    await reportError(error, { op: "account.2fa.status" });
    return NextResponse.json(
      { error: "Не удалось получить состояние 2FA" },
      { status: 500 }
    );
  }
}
