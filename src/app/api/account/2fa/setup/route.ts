import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { reportError } from "@/lib/telemetry";
import {
  generateTotpSecret,
  buildOtpauthUri,
} from "@/lib/totp";

// POST /api/account/2fa/setup
//
// Begin 2FA enrollment. Creates (or replaces) a TotpCredential row in
// the "pending" state (enabledAt = null) and returns the secret + an
// otpauth:// URI for the QR code. The user scans the QR with Google
// Authenticator / Authy / 1Password / Bitwarden, then submits a
// generated code to /api/account/2fa/verify to flip enabledAt.
//
// Calling this when 2FA is already enabled regenerates the secret —
// useful when a user lost their device. They must verify the new
// secret before the old one is invalidated; until verify succeeds the
// row stays "pending" and login still uses the old enabled secret if
// any.
//
// Implementation note: we rotate the row in two cases:
//   1. No row exists — create.
//   2. Row exists but is pending (enabledAt = null) — overwrite secret
//      (idempotent re-setup).
//   3. Row exists and is enabled — refuse with 409. The user must
//      disable first or use the future "regenerate" endpoint.

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json(
        { error: "Требуется авторизация" },
        { status: 401 }
      );
    }
    const userId = session.user.id;

    const existing = await prisma.totpCredential.findUnique({
      where: { userId },
      select: { id: true, enabledAt: true },
    });

    if (existing?.enabledAt) {
      return NextResponse.json(
        {
          error:
            "2FA уже включена. Сначала отключите 2FA, а затем настройте новое устройство.",
          code: "ALREADY_ENABLED",
        },
        { status: 409 }
      );
    }

    const secret = generateTotpSecret();
    const otpauth = buildOtpauthUri(secret, session.user.email);

    if (existing) {
      await prisma.totpCredential.update({
        where: { userId },
        data: { secret, recoveryCodes: [] },
      });
    } else {
      await prisma.totpCredential.create({
        data: { userId, secret, recoveryCodes: [] },
      });
    }

    return NextResponse.json({
      secret,
      otpauth,
      // Hint for UI — show "Введите код из приложения, чтобы завершить
      // настройку"
      pending: true,
    });
  } catch (error) {
    await reportError(error, { op: "account.2fa.setup" });
    return NextResponse.json(
      { error: "Не удалось начать настройку 2FA" },
      { status: 500 }
    );
  }
}
