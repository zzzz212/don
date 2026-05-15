import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { reportError } from "@/lib/telemetry";

// Selected user fields needed to render a connection card. profile is a
// left join — a user may not have opened the network section yet.
const userSelect = {
  id: true,
  name: true,
  image: true,
  profile: { select: { displayName: true, headline: true } },
} as const;

type ConnUser = {
  id: string;
  name: string | null;
  image: string | null;
  profile: { displayName: string | null; headline: string | null } | null;
};

function shapeUser(u: ConnUser) {
  return {
    userId: u.id,
    displayName: u.profile?.displayName ?? u.name ?? "Пользователь",
    headline: u.profile?.headline ?? null,
    image: u.image,
  };
}

// GET /api/network/connections — the viewer's connections split into
// accepted, incoming pending (awaiting my response) and outgoing pending.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const me = session.user.id;
    const rows = await prisma.connection.findMany({
      where: { OR: [{ requesterId: me }, { addresseeId: me }] },
      orderBy: { createdAt: "desc" },
      include: {
        requester: { select: userSelect },
        addressee: { select: userSelect },
      },
    });

    type Entry = {
      connectionId: string;
      message: string | null;
      createdAt: Date;
    } & ReturnType<typeof shapeUser>;

    const connected: Entry[] = [];
    const incoming: Entry[] = [];
    const outgoing: Entry[] = [];

    for (const c of rows) {
      const other = c.requesterId === me ? c.addressee : c.requester;
      const entry: Entry = {
        connectionId: c.id,
        message: c.message,
        createdAt: c.createdAt,
        ...shapeUser(other),
      };
      if (c.status === "ACCEPTED") connected.push(entry);
      else if (c.status === "PENDING" && c.addresseeId === me)
        incoming.push(entry);
      else if (c.status === "PENDING" && c.requesterId === me)
        outgoing.push(entry);
    }

    return NextResponse.json({ connected, incoming, outgoing });
  } catch (error) {
    await reportError(error, { op: "network.connections.list" });
    return NextResponse.json(
      { error: "Не удалось загрузить связи" },
      { status: 500 }
    );
  }
}

const CreateSchema = z.object({
  toUserId: z.string().min(1),
  message: z.string().trim().max(500).optional(),
});

// POST /api/network/connections — send a connection request. Rejects a
// duplicate request in either direction; a previously declined request
// may be re-sent (the stale row is dropped first).
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const me = session.user.id;
    const parsed = CreateSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }
    const { toUserId, message } = parsed.data;
    if (toUserId === me) {
      return NextResponse.json(
        { error: "Нельзя добавить себя" },
        { status: 400 }
      );
    }

    const target = await prisma.user.findUnique({
      where: { id: toUserId },
      select: { id: true },
    });
    if (!target) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    const existing = await prisma.connection.findFirst({
      where: {
        OR: [
          { requesterId: me, addresseeId: toUserId },
          { requesterId: toUserId, addresseeId: me },
        ],
      },
    });
    if (existing) {
      if (existing.status !== "DECLINED") {
        return NextResponse.json(
          {
            error:
              existing.status === "ACCEPTED"
                ? "Вы уже связаны с этим пользователем"
                : "Запрос уже отправлен",
          },
          { status: 409 }
        );
      }
      // A declined request is not permanent — clear it and start fresh.
      await prisma.connection.delete({ where: { id: existing.id } });
    }

    const connection = await prisma.connection.create({
      data: {
        requesterId: me,
        addresseeId: toUserId,
        message: message && message.length > 0 ? message : null,
      },
    });
    return NextResponse.json({ connection });
  } catch (error) {
    await reportError(error, { op: "network.connections.create" });
    return NextResponse.json(
      { error: "Не удалось отправить запрос" },
      { status: 500 }
    );
  }
}
