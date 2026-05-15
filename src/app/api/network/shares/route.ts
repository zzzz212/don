import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  areConnected,
  NETWORK_USER_SELECT,
  shapeNetworkUser,
  type NetworkUser,
} from "@/lib/network";
import { reportError } from "@/lib/telemetry";

// GET /api/network/shares — contracts the viewer has sent for review and
// contracts sent to them, newest first.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const me = session.user.id;

    const shares = await prisma.documentShare.findMany({
      where: { OR: [{ fromUserId: me }, { toUserId: me }] },
      orderBy: { createdAt: "desc" },
      include: {
        fromUser: { select: NETWORK_USER_SELECT },
        toUser: { select: NETWORK_USER_SELECT },
        document: { select: { fileName: true } },
        _count: { select: { comments: true } },
      },
    });

    const shape = (s: (typeof shares)[number]) => ({
      id: s.id,
      kind: s.kind,
      status: s.status,
      message: s.message,
      createdAt: s.createdAt,
      commentCount: s._count.comments,
      documentName: s.document?.fileName ?? "Документ",
    });

    const received = shares
      .filter((s) => s.toUserId === me)
      .map((s) => ({
        ...shape(s),
        counterpart: shapeNetworkUser(s.fromUser as NetworkUser),
      }));
    const sent = shares
      .filter((s) => s.fromUserId === me)
      .map((s) => ({
        ...shape(s),
        counterpart: shapeNetworkUser(s.toUser as NetworkUser),
      }));

    return NextResponse.json({ received, sent });
  } catch (error) {
    await reportError(error, { op: "network.shares.list" });
    return NextResponse.json(
      { error: "Не удалось загрузить ревью" },
      { status: 500 }
    );
  }
}

const CreateSchema = z.object({
  toUserId: z.string().min(1),
  documentId: z.string().min(1),
  message: z.string().trim().max(500).optional(),
});

// POST /api/network/shares — send one of your analysed contracts to a
// connected user for review. You can only share with people you are
// connected with, and only documents you own.
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
    const { toUserId, documentId, message } = parsed.data;

    if (!(await areConnected(me, toUserId))) {
      return NextResponse.json(
        { error: "Отправлять документы можно только пользователям из ваших связей" },
        { status: 403 }
      );
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, userId: true },
    });
    if (!document || document.userId !== me) {
      return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
    }

    // One open share of the same document to the same person is enough.
    const dup = await prisma.documentShare.findFirst({
      where: {
        documentId,
        toUserId,
        status: { in: ["PENDING", "ACCEPTED"] },
      },
      select: { id: true },
    });
    if (dup) {
      return NextResponse.json(
        { error: "Этот документ уже отправлен этому пользователю" },
        { status: 409 }
      );
    }

    const share = await prisma.documentShare.create({
      data: {
        fromUserId: me,
        toUserId,
        documentId,
        kind: "REVIEW",
        message: message && message.length > 0 ? message : null,
      },
    });
    return NextResponse.json({ share });
  } catch (error) {
    await reportError(error, { op: "network.shares.create" });
    return NextResponse.json(
      { error: "Не удалось отправить документ" },
      { status: 500 }
    );
  }
}
