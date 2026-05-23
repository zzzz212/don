import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { reportError } from "@/lib/telemetry";

// PATCH /api/account — update the user's profile fields. Currently only
// the display name; email is owned by the auth provider (Credentials =
// signup-time-only, Google = managed upstream) and changing it would
// invalidate sessions / sign-ins. If the user wants a new email we'll
// add a verification flow later.

const PatchSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Минимум 2 символа")
    .max(80, "Максимум 80 символов"),
});

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Неверные данные" },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { name: parsed.data.name },
      select: { id: true, name: true, email: true },
    });
    return NextResponse.json(updated);
  } catch (e) {
    reportError(e, { op: "account.patch", userId: session.user.id });
    return NextResponse.json(
      { error: "Не удалось сохранить изменения" },
      { status: 500 }
    );
  }
}
