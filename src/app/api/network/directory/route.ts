import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { connectionStates } from "@/lib/network";
import { reportError } from "@/lib/telemetry";

// One screen of catalogue results. The directory is a discovery surface,
// not a data export — a hard cap keeps the response small.
const PAGE_SIZE = 24;

// GET /api/network/directory?q= — search the opt-in user catalogue.
// Only profiles with discoverable=true are ever returned, and the
// signed-in user is excluded from their own results.
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const me = session.user.id;
    const q = (request.nextUrl.searchParams.get("q") ?? "").trim();

    const profiles = await prisma.userProfile.findMany({
      where: {
        discoverable: true,
        userId: { not: me },
        ...(q
          ? {
              OR: [
                { displayName: { contains: q, mode: "insensitive" } },
                { headline: { contains: q, mode: "insensitive" } },
                { specialization: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: PAGE_SIZE,
      include: { user: { select: { name: true, image: true } } },
    });

    // Annotate each result with the viewer's connection state so the UI
    // can render "Связаться" / "Запрос отправлен" / "Вы связаны".
    const states = await connectionStates(
      me,
      profiles.map((p) => p.userId)
    );

    const results = profiles.map((p) => ({
      userId: p.userId,
      displayName: p.displayName ?? p.user.name ?? "Пользователь",
      headline: p.headline,
      specialization: p.specialization,
      bio: p.bio,
      image: p.user.image,
      connection: states.get(p.userId) ?? "none",
    }));

    return NextResponse.json({ results });
  } catch (error) {
    await reportError(error, { op: "network.directory" });
    return NextResponse.json(
      { error: "Не удалось загрузить каталог" },
      { status: 500 }
    );
  }
}
