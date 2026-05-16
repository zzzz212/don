import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureActiveOrg } from "@/lib/org";
import { reportError } from "@/lib/telemetry";

const Schema = z.object({ messageId: z.string().min(1) });

// POST /api/network/messages/[id]/copy  { messageId }
//   Save a generated document that was forwarded into this conversation
//   into the caller's own workspace. [id] is the conversation id; the
//   caller must be a participant. The copy is a fresh GeneratedDocument
//   the recipient fully owns — generated documents are org-scoped, so
//   the recipient can't open the sender's copy directly.
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
    const { id: conversationId } = await params;

    const parsed = Schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }

    const convo = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { userAId: true, userBId: true },
    });
    if (!convo || (convo.userAId !== me && convo.userBId !== me)) {
      return NextResponse.json(
        { error: "Переписка не найдена" },
        { status: 404 }
      );
    }

    const message = await prisma.directMessage.findUnique({
      where: { id: parsed.data.messageId },
      include: { attachment: true },
    });
    if (
      !message ||
      message.conversationId !== conversationId ||
      !message.attachment
    ) {
      return NextResponse.json(
        { error: "Документ из этого сообщения недоступен" },
        { status: 404 }
      );
    }
    const src = message.attachment;

    const orgId = await ensureActiveOrg(me);
    const formData = (src.formData ?? {}) as Prisma.InputJsonValue;

    const copy = await prisma.$transaction(async (tx) => {
      const created = await tx.generatedDocument.create({
        data: {
          userId: me,
          orgId,
          templateId: src.templateId,
          name: src.name,
          content: src.content,
          formData,
        },
      });
      // foot-gun #14 — a generated doc needs a v1 row up front or its
      // version history reads "Нет версий" forever.
      await tx.documentVersion.create({
        data: {
          generatedDocId: created.id,
          versionNumber: 1,
          title: created.name,
          content: created.content,
          formData,
          createdBy: me,
        },
      });
      return created;
    });

    return NextResponse.json({ documentId: copy.id });
  } catch (error) {
    await reportError(error, { op: "network.messages.copy" });
    return NextResponse.json(
      { error: "Не удалось сохранить документ" },
      { status: 500 }
    );
  }
}
