import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { reportError } from "@/lib/telemetry";

// GET /api/network/users/[id] — one user's public profile plus the
// viewer's connection state with them. A non-discoverable user is
// visible only to people who already have a connection (pending or
// accepted) with them — otherwise 404, so the opt-in catalogue can't be
// bypassed by guessing ids.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const me = session.user.id;
    const { id } = await params;

    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        image: true,
        profile: {
          select: {
            discoverable: true,
            displayName: true,
            headline: true,
            bio: true,
            specialization: true,
          },
        },
      },
    });
    if (!target) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    const conn = await prisma.connection.findFirst({
      where: {
        OR: [
          { requesterId: me, addresseeId: id },
          { requesterId: id, addresseeId: me },
        ],
      },
    });

    let connection: "none" | "connected" | "incoming" | "outgoing" | "declined" =
      "none";
    if (conn) {
      if (conn.status === "ACCEPTED") connection = "connected";
      else if (conn.status === "DECLINED") connection = "declined";
      else if (conn.requesterId === me) connection = "outgoing";
      else connection = "incoming";
    }

    const isSelf = id === me;
    const discoverable = target.profile?.discoverable ?? false;
    // A stranger who hasn't opted into the catalogue stays hidden.
    if (!isSelf && !discoverable && !conn) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      userId: target.id,
      isSelf,
      displayName:
        target.profile?.displayName ?? target.name ?? "Пользователь",
      headline: target.profile?.headline ?? null,
      bio: target.profile?.bio ?? null,
      specialization: target.profile?.specialization ?? null,
      image: target.image,
      connection,
      connectionId: conn?.id ?? null,
    });
  } catch (error) {
    await reportError(error, { op: "network.user.profile" });
    return NextResponse.json(
      { error: "Не удалось загрузить профиль" },
      { status: 500 }
    );
  }
}
