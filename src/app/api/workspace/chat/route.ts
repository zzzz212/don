import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  ensureActiveOrg,
  requireMembership,
  OrgAccessError,
} from "@/lib/org";
import { rateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/telemetry";

// Workspace team chat — one implicit channel per active workspace.

const MAX_MESSAGES = 100;

const senderSelect = {
  id: true,
  name: true,
  image: true,
  profile: { select: { displayName: true } },
} as const;

type SenderRow = {
  id: string;
  name: string | null;
  image: string | null;
  profile: { displayName: string | null } | null;
};

function senderName(s: SenderRow): string {
  return s.profile?.displayName ?? s.name ?? "Участник";
}

// GET /api/workspace/chat — the workspace channel (last 100 messages,
// oldest first). Any member, including VIEWER, may read. Opening the
// channel marks it read.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const orgId =
      session.user.activeOrgId ?? (await ensureActiveOrg(userId));
    const membership = await requireMembership(userId, orgId, "VIEWER");

    const rows = await prisma.workspaceMessage.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: MAX_MESSAGES,
      include: { sender: { select: senderSelect } },
    });

    await prisma.membership.update({
      where: { userId_orgId: { userId, orgId } },
      data: { chatReadAt: new Date() },
    });

    const messages = rows
      .reverse()
      .map((m) => ({
        id: m.id,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        senderId: m.senderId,
        senderName: senderName(m.sender),
        senderImage: m.sender.image,
        isMe: m.senderId === userId,
      }));

    return NextResponse.json({
      messages,
      canPost: membership.role !== "VIEWER",
      orgName: membership.organization.name,
    });
  } catch (error) {
    if (error instanceof OrgAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    await reportError(error, { op: "workspace.chat.list" });
    return NextResponse.json(
      { error: "Не удалось загрузить чат" },
      { status: 500 }
    );
  }
}

const SendSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

// POST /api/workspace/chat — post a message. MEMBER+ only; a VIEWER is
// read-only (requireMembership rejects rank < MEMBER).
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const orgId =
      session.user.activeOrgId ?? (await ensureActiveOrg(userId));
    await requireMembership(userId, orgId, "MEMBER");

    const { ok } = await rateLimit(userId, "workspace-chat");
    if (!ok) {
      return NextResponse.json(
        { error: "Слишком много сообщений подряд. Подождите минуту." },
        { status: 429 }
      );
    }

    const parsed = SendSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Сообщение не может быть пустым" },
        { status: 400 }
      );
    }

    const created = await prisma.workspaceMessage.create({
      data: { orgId, senderId: userId, body: parsed.data.body },
      include: { sender: { select: senderSelect } },
    });

    // The sender has implicitly read up to their own message.
    await prisma.membership.update({
      where: { userId_orgId: { userId, orgId } },
      data: { chatReadAt: new Date() },
    });

    return NextResponse.json({
      message: {
        id: created.id,
        body: created.body,
        createdAt: created.createdAt.toISOString(),
        senderId: created.senderId,
        senderName: senderName(created.sender),
        senderImage: created.sender.image,
        isMe: true,
      },
    });
  } catch (error) {
    if (error instanceof OrgAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    await reportError(error, { op: "workspace.chat.send" });
    return NextResponse.json(
      { error: "Не удалось отправить сообщение" },
      { status: 500 }
    );
  }
}
