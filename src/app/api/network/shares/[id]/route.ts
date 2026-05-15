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

// Best-effort JSON parse for the analysis columns, which are stored as
// strings. A malformed row degrades to a sane empty value rather than
// throwing the whole request.
function safeParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// GET /api/network/shares/[id] — full review detail: the contract text,
// its analysis and the comment thread. Visible only to the two parties.
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

    const share = await prisma.documentShare.findUnique({
      where: { id },
      include: {
        fromUser: { select: NETWORK_USER_SELECT },
        toUser: { select: NETWORK_USER_SELECT },
        document: { include: { analysis: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: NETWORK_USER_SELECT } },
        },
      },
    });
    if (!share || (share.fromUserId !== me && share.toUserId !== me)) {
      return NextResponse.json({ error: "Ревью не найдено" }, { status: 404 });
    }

    const a = share.document?.analysis;
    return NextResponse.json({
      id: share.id,
      kind: share.kind,
      status: share.status,
      message: share.message,
      createdAt: share.createdAt,
      role: share.fromUserId === me ? "sender" : "reviewer",
      from: shapeNetworkUser(share.fromUser as NetworkUser),
      to: shapeNetworkUser(share.toUser as NetworkUser),
      document: share.document
        ? {
            fileName: share.document.fileName,
            rawText: share.document.rawText,
            score: a?.score ?? null,
            summary: a?.summary ?? null,
            risks: safeParse<unknown[]>(a?.risks, []),
            metadata: safeParse<Record<string, unknown>>(a?.metadata, {}),
          }
        : null,
      comments: share.comments.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt,
        author: shapeNetworkUser(c.author as NetworkUser),
        mine: c.authorId === me,
      })),
    });
  } catch (error) {
    await reportError(error, { op: "network.shares.detail" });
    return NextResponse.json(
      { error: "Не удалось загрузить ревью" },
      { status: 500 }
    );
  }
}

const PatchSchema = z.object({
  action: z.enum(["accept", "decline", "complete"]),
});

// PATCH /api/network/shares/[id] — move the review through its workflow.
// accept/decline are the reviewer's call on a PENDING share; complete may
// be marked by either party once the share is ACCEPTED.
export async function PATCH(
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
    const parsed = PatchSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Некорректное действие" },
        { status: 400 }
      );
    }
    const { action } = parsed.data;

    const share = await prisma.documentShare.findUnique({ where: { id } });
    if (!share || (share.fromUserId !== me && share.toUserId !== me)) {
      return NextResponse.json({ error: "Ревью не найдено" }, { status: 404 });
    }

    if (action === "accept" || action === "decline") {
      if (share.toUserId !== me) {
        return NextResponse.json(
          { error: "Отвечать на запрос может только получатель" },
          { status: 403 }
        );
      }
      if (share.status !== "PENDING") {
        return NextResponse.json(
          { error: "Запрос уже рассмотрен" },
          { status: 409 }
        );
      }
    } else {
      // complete
      if (share.status !== "ACCEPTED") {
        return NextResponse.json(
          { error: "Завершить можно только принятое ревью" },
          { status: 409 }
        );
      }
    }

    const status =
      action === "accept"
        ? "ACCEPTED"
        : action === "decline"
          ? "DECLINED"
          : "COMPLETED";

    const updated = await prisma.documentShare.update({
      where: { id },
      data: { status, respondedAt: new Date() },
    });
    return NextResponse.json({ share: updated });
  } catch (error) {
    await reportError(error, { op: "network.shares.respond" });
    return NextResponse.json(
      { error: "Не удалось обновить ревью" },
      { status: 500 }
    );
  }
}

// DELETE /api/network/shares/[id] — the sender revokes the share.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const share = await prisma.documentShare.findUnique({ where: { id } });
    if (!share || share.fromUserId !== session.user.id) {
      return NextResponse.json({ error: "Ревью не найдено" }, { status: 404 });
    }
    await prisma.documentShare.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await reportError(error, { op: "network.shares.delete" });
    return NextResponse.json(
      { error: "Не удалось отозвать ревью" },
      { status: 500 }
    );
  }
}
