import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  networkRateLimitOk,
  NETWORK_USER_SELECT,
  shapeNetworkUser,
  type NetworkUser,
} from "@/lib/network";
import { sendEmail } from "@/lib/email";
import { buildNetworkMessageEmail } from "@/lib/email/templates/network-message";
import { BRAND } from "@/lib/legal-info";
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
      include: { attachment: { select: { id: true, name: true } } },
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
        attachment: m.attachment
          ? { id: m.attachment.id, name: m.attachment.name }
          : null,
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
  body: z.string().trim().max(4000).optional().default(""),
  // A generated document forwarded into the conversation.
  attachmentGeneratedDocId: z.string().min(1).optional(),
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
    if (!(await networkRateLimitOk(me))) {
      return NextResponse.json(
        { error: "Слишком много сообщений подряд. Подождите минуту." },
        { status: 429 }
      );
    }
    const { id } = await params;
    const parsed = SendSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Некорректное сообщение" },
        { status: 400 }
      );
    }
    const { body, attachmentGeneratedDocId } = parsed.data;
    if (!body && !attachmentGeneratedDocId) {
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

    // A forwarded document must belong to the sender.
    if (attachmentGeneratedDocId) {
      const doc = await prisma.generatedDocument.findUnique({
        where: { id: attachmentGeneratedDocId },
        select: { userId: true },
      });
      if (!doc || doc.userId !== me) {
        return NextResponse.json(
          { error: "Документ недоступен" },
          { status: 404 }
        );
      }
    }

    const message = await prisma.directMessage.create({
      data: {
        conversationId: id,
        senderId: me,
        body,
        attachmentGeneratedDocId: attachmentGeneratedDocId ?? null,
      },
      include: { attachment: { select: { id: true, name: true } } },
    });

    // Email the other side only for the very first message of a thread —
    // an ongoing conversation is covered by the in-app unread badge, so
    // per-message email would just be noise.
    const total = await prisma.directMessage.count({
      where: { conversationId: id },
    });
    if (total === 1) {
      const otherId =
        convo.userAId === me ? convo.userBId : convo.userAId;
      const people = await prisma.user.findMany({
        where: { id: { in: [me, otherId] } },
        select: {
          id: true,
          email: true,
          name: true,
          profile: { select: { displayName: true } },
        },
      });
      const recipient = people.find((u) => u.id === otherId);
      const sender = people.find((u) => u.id === me);
      if (recipient?.email) {
        await sendEmail(
          buildNetworkMessageEmail({
            to: recipient.email,
            fromName:
              sender?.profile?.displayName ?? sender?.name ?? "Пользователь",
            preview: (body || "Вам прислали документ").slice(0, 140),
            threadUrl: `${BRAND.publicUrl}/network/messages/${id}`,
          })
        );
      }
    }

    return NextResponse.json({
      message: {
        id: message.id,
        body: message.body,
        createdAt: message.createdAt,
        mine: true,
        attachment: message.attachment
          ? { id: message.attachment.id, name: message.attachment.name }
          : null,
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
