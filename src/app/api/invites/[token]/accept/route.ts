import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { reportError } from "@/lib/telemetry";
import { captureEvent } from "@/lib/analytics/server";

// POST /api/invites/[token]/accept
//   Convert an invite into a Membership for the logged-in user. Idempotent
//   when the user is already a member of that org (no error, just returns
//   existing membership). Single-use otherwise — invite.acceptedAt is
//   stamped so the same link can't be reused by someone else later.

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: "Войдите в аккаунт, чтобы принять приглашение",
          code: "AUTH_REQUIRED",
        },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const { token } = await params;

    const invite = await prisma.invite.findUnique({ where: { token } });

    if (!invite) {
      return NextResponse.json(
        { error: "Приглашение не найдено", code: "NOT_FOUND" },
        { status: 404 }
      );
    }
    if (invite.acceptedAt) {
      return NextResponse.json(
        { error: "Приглашение уже использовано", code: "ALREADY_ACCEPTED" },
        { status: 410 }
      );
    }
    if (invite.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Срок действия приглашения истёк", code: "EXPIRED" },
        { status: 410 }
      );
    }

    // If the user is already a member, treat as success — re-pasting the
    // link shouldn't error. The invite stays unaccepted so others can still
    // use it (in case it's a generic team link).
    const existing = await prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId: invite.orgId } },
    });
    if (existing) {
      // Set the org as active so the redirect lands them in the right place.
      await prisma.user.update({
        where: { id: userId },
        data: { activeOrgId: invite.orgId },
      });
      return NextResponse.json({
        success: true,
        orgId: invite.orgId,
        alreadyMember: true,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.membership.create({
        data: { userId, orgId: invite.orgId, role: invite.role },
      });
      await tx.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
      // Switch the new member into this workspace immediately so the next
      // page they see is already the right context.
      await tx.user.update({
        where: { id: userId },
        data: { activeOrgId: invite.orgId },
      });
    });

    void captureEvent({
      userId,
      orgId: invite.orgId,
      event: "invite_accepted",
      properties: { role: invite.role },
    });

    return NextResponse.json({ success: true, orgId: invite.orgId });
  } catch (error) {
    await reportError(error, { op: "invites.accept" });
    return NextResponse.json(
      { error: "Не удалось принять приглашение" },
      { status: 500 }
    );
  }
}
