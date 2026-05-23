import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  areConnected,
  conversationPairKey,
  NETWORK_USER_SELECT,
  shapeNetworkUser,
  type NetworkUser,
} from "@/lib/network";
import { reportError } from "@/lib/telemetry";

// GET /api/network/messages — the viewer's conversations, most recently
// active first, each with its last message and an unread count.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const me = session.user.id;

    const convos = await prisma.conversation.findMany({
      where: { OR: [{ userAId: me }, { userBId: me }] },
      include: {
        userA: { select: NETWORK_USER_SELECT },
        userB: { select: NETWORK_USER_SELECT },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    // Unread = messages from the other party I haven't opened yet. One
    // grouped query rather than a per-conversation count.
    const ids = convos.map((c) => c.id);
    const unreadRows = ids.length
      ? await prisma.directMessage.groupBy({
          by: ["conversationId"],
          where: {
            conversationId: { in: ids },
            senderId: { not: me },
            readAt: null,
          },
          _count: true,
        })
      : [];
    const unread = new Map(
      unreadRows.map((r) => [r.conversationId, r._count])
    );

    const conversations = convos
      .map((c) => {
        const other = c.userAId === me ? c.userB : c.userA;
        const last = c.messages[0];
        return {
          id: c.id,
          counterpart: shapeNetworkUser(other as NetworkUser),
          lastMessage: last
            ? {
                body: last.body,
                createdAt: last.createdAt,
                mine: last.senderId === me,
              }
            : null,
          unread: unread.get(c.id) ?? 0,
          sortAt: last ? last.createdAt : c.createdAt,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime()
      );

    return NextResponse.json({ conversations });
  } catch (error) {
    await reportError(error, { op: "network.messages.list" });
    return NextResponse.json(
      { error: "Не удалось загрузить переписку" },
      { status: 500 }
    );
  }
}

const StartSchema = z.object({ toUserId: z.string().min(1) });

// POST /api/network/messages — find or create the conversation with a
// connected user, returning its id. The thread page takes it from there.
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const me = session.user.id;
    const parsed = StartSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }
    const { toUserId } = parsed.data;
    if (toUserId === me) {
      return NextResponse.json(
        { error: "Нельзя написать самому себе" },
        { status: 400 }
      );
    }
    if (!(await areConnected(me, toUserId))) {
      return NextResponse.json(
        { error: "Писать можно только пользователям из ваших связей" },
        { status: 403 }
      );
    }

    const pairKey = conversationPairKey(me, toUserId);
    const [userAId, userBId] = [me, toUserId].sort();
    const conversation = await prisma.conversation.upsert({
      where: { pairKey },
      update: {},
      create: { pairKey, userAId, userBId },
    });

    return NextResponse.json({ conversationId: conversation.id });
  } catch (error) {
    await reportError(error, { op: "network.messages.start" });
    return NextResponse.json(
      { error: "Не удалось открыть переписку" },
      { status: 500 }
    );
  }
}
