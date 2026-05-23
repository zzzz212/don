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
import { reportError } from "@/lib/telemetry";

const CommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

// POST /api/network/shares/[id]/comments — add a message to the review
// thread. Either party may comment while the share is live.
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
        { error: "Слишком много действий подряд. Подождите минуту." },
        { status: 429 }
      );
    }
    const { id } = await params;
    const parsed = CommentSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Комментарий не может быть пустым" },
        { status: 400 }
      );
    }

    const share = await prisma.documentShare.findUnique({
      where: { id },
      select: { id: true, fromUserId: true, toUserId: true, status: true },
    });
    if (!share || (share.fromUserId !== me && share.toUserId !== me)) {
      return NextResponse.json({ error: "Ревью не найдено" }, { status: 404 });
    }
    if (share.status === "DECLINED") {
      return NextResponse.json(
        { error: "Ревью отклонено — обсуждение недоступно" },
        { status: 409 }
      );
    }

    const comment = await prisma.shareComment.create({
      data: { shareId: id, authorId: me, body: parsed.data.body },
      include: { author: { select: NETWORK_USER_SELECT } },
    });

    return NextResponse.json({
      comment: {
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt,
        author: shapeNetworkUser(comment.author as NetworkUser),
        mine: true,
      },
    });
  } catch (error) {
    await reportError(error, { op: "network.shares.comment" });
    return NextResponse.json(
      { error: "Не удалось отправить комментарий" },
      { status: 500 }
    );
  }
}
