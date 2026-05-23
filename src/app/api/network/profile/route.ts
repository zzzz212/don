import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureProfile } from "@/lib/network";
import { reportError } from "@/lib/telemetry";

// GET /api/network/profile — the signed-in user's own network profile.
// Lazily created on first read, so the UI always gets a row back.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const profile = await ensureProfile(session.user.id);
    return NextResponse.json({ profile });
  } catch (error) {
    await reportError(error, { op: "network.profile.get" });
    return NextResponse.json(
      { error: "Не удалось загрузить профиль" },
      { status: 500 }
    );
  }
}

const UpdateSchema = z.object({
  discoverable: z.boolean().optional(),
  displayName: z.string().trim().max(80).nullish(),
  headline: z.string().trim().max(120).nullish(),
  bio: z.string().trim().max(1000).nullish(),
  specialization: z.string().trim().max(200).nullish(),
});

// PUT /api/network/profile — update own profile. Empty strings collapse
// to null so the catalogue never shows blank headlines.
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const parsed = UpdateSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Некорректные данные профиля" },
        { status: 400 }
      );
    }
    await ensureProfile(session.user.id);

    const d = parsed.data;
    const clean = (v: string | null | undefined) =>
      v == null || v.length === 0 ? null : v;

    const profile = await prisma.userProfile.update({
      where: { userId: session.user.id },
      data: {
        ...(d.discoverable !== undefined
          ? { discoverable: d.discoverable }
          : {}),
        ...(d.displayName !== undefined
          ? { displayName: clean(d.displayName) }
          : {}),
        ...(d.headline !== undefined ? { headline: clean(d.headline) } : {}),
        ...(d.bio !== undefined ? { bio: clean(d.bio) } : {}),
        ...(d.specialization !== undefined
          ? { specialization: clean(d.specialization) }
          : {}),
      },
    });
    return NextResponse.json({ profile });
  } catch (error) {
    await reportError(error, { op: "network.profile.update" });
    return NextResponse.json(
      { error: "Не удалось сохранить профиль" },
      { status: 500 }
    );
  }
}
