import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { OrgAccessError, requireMembership } from "@/lib/org";
import { reportError } from "@/lib/telemetry";

// POST /api/organizations/[id]/switch
//   Set this workspace as the user's active context. Membership is required
//   (you can't switch to a workspace you don't belong to). The next session
//   refresh picks up the new activeOrgId via ensureActiveOrg.

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await requireMembership(session.user.id, id, "MEMBER");

    await prisma.user.update({
      where: { id: session.user.id },
      data: { activeOrgId: id },
    });

    return NextResponse.json({ success: true, activeOrgId: id });
  } catch (error) {
    if (error instanceof OrgAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    await reportError(error, { op: "organizations.switch" });
    return NextResponse.json(
      { error: "Не удалось переключить workspace" },
      { status: 500 }
    );
  }
}
