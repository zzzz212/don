import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  NETWORK_USER_SELECT,
  shapeNetworkUser,
  type NetworkUser,
} from "@/lib/network";
import { reportError } from "@/lib/telemetry";

// Most recent slice of a thread. Conversations rarely need deep history
// in this product, so a cap keeps the payload bounded.
const MESSAGE_LIMIT = 200;

// GET /api/network/messages/[id] — a conversation thread. Opening it
// marks the other party's messages as read.
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

    const convo = await prisma.conversation.findUnique({
      where: { id },
      include: {
        userA: { select: NETWORK_USER_SELECT },
        userB: { select: NETWORK_USER_SELECT },
      },
    });
    if (!convo || (convo.userAId !== me && convo.userBId !== me)) {
      return NextResponse.json(
        { error: "Переписка не найдена" },
        { status: 404 }
      );
    }

    await prisma.directMessage.updateMany({
      where: { conversationId: id, senderId: { not: me }, readAt: null },
      data: { readAt: new Date() },
    });

    const messages = await prisma.directMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
      take: MESSAGE_LIMIT,
    });

    const other = convo.userAId === me ? convo.userB : convo.userA;
    return NextResponse.json({
      conversationId: id,
      counterpart: shapeNetworkUser(other as NetworkUser),
      messages: messages.map((m) => ({
        id: m.id,
        body: m.body,
        createdAt: m.createdAt,
        mine: m.senderId === me,
      })),
    });
  } catch (error) {
    await reportError(error, { op: "network.messages.thread" });
    return NextResponse.json(
      { error: "Не удалось загрузить переписку" },
      { status: 500 }
    );
  }
}

const SendSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

// POST /api/network/messages/[id] — send a message into the thread.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const me = session.user.id;
    const { id } = await params;
    const parsed = SendSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Сообщение не может быть пустым" },
        { status: 400 }
      );
    }

    const convo = await prisma.conversation.findUnique({
      where: { id },
      select: { id: true, userAId: true, userBId: true },
    });
    if (!convo || (convo.userAId !== me && convo.userBId !== me)) {
      return NextResponse.json(
        { error: "Переписка не найдена" },
        { status: 404 }
      );
    }

    const message = await prisma.directMessage.create({
      data: { conversationId: id, senderId: me, body: parsed.data.body },
    });

    return NextResponse.json({
      message: {
        id: message.id,
        body: message.body,
        createdAt: message.createdAt,
        mine: true,
      },
    });
  } catch (error) {
    await reportError(error, { op: "network.messages.send" });
    return NextResponse.json(
      { error: "Не удалось отправить сообщение" },
      { status: 500 }
    );
  }
}
