import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { reportError } from "@/lib/telemetry";

// GET /api/invites/[token]
//   Public preview of an invite — used by the /invite/[token] page to show
//   "You've been invited to join Acme Inc as MEMBER" before the user logs
//   in or accepts. The token is unguessable (256 bits) so we treat
//   knowledge of the token as proof of being the intended recipient.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const invite = await prisma.invite.findUnique({
      where: { token },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
      },
    });

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
        {
          error: "Срок действия приглашения истёк",
          code: "EXPIRED",
          expiredAt: invite.expiresAt.toISOString(),
        },
        { status: 410 }
      );
    }

    return NextResponse.json({
      organization: {
        id: invite.organization.id,
        name: invite.organization.name,
      },
      role: invite.role,
      email: invite.email,
      expiresAt: invite.expiresAt.toISOString(),
    });
  } catch (error) {
    await reportError(error, { op: "invites.preview" });
    return NextResponse.json(
      { error: "Не удалось загрузить приглашение" },
      { status: 500 }
    );
  }
}
