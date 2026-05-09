import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { OrgAccessError, requireMembership } from "@/lib/org";
import { reportError } from "@/lib/telemetry";

// DELETE /api/organizations/[id]/invites/[inviteId]
//   Revoke a pending invite link. Once revoked, accept attempts return 410.
//   ADMIN+ only.

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; inviteId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, inviteId } = await params;
    await requireMembership(session.user.id, id, "ADMIN");

    // Org-scoped lookup so an admin of one org can't revoke another org's
    // invite by id-guessing.
    const invite = await prisma.invite.findFirst({
      where: { id: inviteId, orgId: id },
      select: { id: true },
    });
    if (!invite) {
      return NextResponse.json(
        { error: "Приглашение не найдено" },
        { status: 404 }
      );
    }

    await prisma.invite.delete({ where: { id: invite.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof OrgAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    await reportError(error, { op: "invites.revoke" });
    return NextResponse.json(
      { error: "Не удалось отозвать приглашение" },
      { status: 500 }
    );
  }
}
