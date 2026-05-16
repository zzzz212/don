import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureActiveOrg } from "@/lib/org";
import { reportError } from "@/lib/telemetry";

// GET /api/workspace/chat/unread — count of workspace-chat messages from
// other members since this member last opened the channel. Powers the
// header nav badge; designed to never throw so a broken count can't
// break the header — failures degrade to { count: 0 }.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ count: 0 });
    const userId = session.user.id;
    const orgId =
      session.user.activeOrgId ?? (await ensureActiveOrg(userId));

    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId } },
      select: { chatReadAt: true },
    });
    if (!membership) return NextResponse.json({ count: 0 });

    const count = await prisma.workspaceMessage.count({
      where: {
        orgId,
        senderId: { not: userId },
        ...(membership.chatReadAt
          ? { createdAt: { gt: membership.chatReadAt } }
          : {}),
      },
    });
    return NextResponse.json({ count });
  } catch (error) {
    await reportError(error, { op: "workspace.chat.unread" });
    return NextResponse.json({ count: 0 });
  }
}
