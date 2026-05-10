import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

// POST /api/auth/check-2fa  { email, password }
//
// Pre-flight check before signIn(). Returns whether the credentials are
// valid AND whether 2FA is required. The client uses this to decide
// whether to show the TOTP input field BEFORE the actual signIn() call.
//
// Privacy: we don't reveal which of email or password was wrong (single
// "Неверный email или пароль" message), and we don't reveal whether 2FA
// is on for an unknown email — only after credentials check.
//
// Rate limit: this is a credential probe primitive — apply same limit as
// /login itself (10/min/IP) so an attacker can't dictionary-test.

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "anonymous";
  const rl = await rateLimit(ip, "default");
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Слишком много попыток. Подождите минуту." },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: unknown;
    password?: unknown;
  };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "Введите email и пароль" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      password: true,
      totp: { select: { enabledAt: true } },
    },
  });

  // Generic error — don't leak which user exists.
  if (!user || !user.password) {
    return NextResponse.json(
      { ok: false, error: "Неверный email или пароль" },
      { status: 401 }
    );
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return NextResponse.json(
      { ok: false, error: "Неверный email или пароль" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok: true,
    requires2FA: !!user.totp?.enabledAt,
  });
}
