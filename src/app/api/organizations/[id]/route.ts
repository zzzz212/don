import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { OrgAccessError, requireMembership } from "@/lib/org";
import { reportError } from "@/lib/telemetry";

// GET /api/organizations/[id]
//   Workspace details + member list. Visible to any member.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const me = await requireMembership(session.user.id, id, "MEMBER");

    const [org, members] = await Promise.all([
      prisma.organization.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          createdAt: true,
        },
      }),
      prisma.membership.findMany({
        where: { orgId: id },
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    if (!org) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    return NextResponse.json({
      organization: org,
      myRole: me.role,
      members: members.map((m) => ({
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
        role: m.role,
        isMe: m.user.id === session.user.id,
        joinedAt: m.createdAt,
      })),
    });
  } catch (error) {
    if (error instanceof OrgAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    await reportError(error, { op: "organizations.get" });
    return NextResponse.json(
      { error: "Не удалось загрузить workspace" },
      { status: 500 }
    );
  }
}

// PATCH /api/organizations/[id]  { name }
//   Rename. ADMIN+ only.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await requireMembership(session.user.id, id, "ADMIN");

    const body = (await request.json().catch(() => ({}))) as {
      name?: unknown;
    };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2 || name.length > 80) {
      return NextResponse.json(
        { error: "Название workspace должно быть от 2 до 80 символов" },
        { status: 400 }
      );
    }

    const updated = await prisma.organization.update({
      where: { id },
      data: { name },
      select: { id: true, name: true, slug: true, plan: true, createdAt: true },
    });

    return NextResponse.json({ organization: updated });
  } catch (error) {
    if (error instanceof OrgAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    await reportError(error, { op: "organizations.patch" });
    return NextResponse.json(
      { error: "Не удалось обновить workspace" },
      { status: 500 }
    );
  }
}

// DELETE /api/organizations/[id]
//   Permanently delete the workspace and everything in it (CASCADE handles
//   documents, chats, etc). OWNER only. The user can't delete their last
//   workspace — they always need at least one to operate in.
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
    await requireMembership(session.user.id, id, "OWNER");

    // Refuse to delete the last workspace — leaves the user in a broken
    // "no active org" state otherwise.
    const remaining = await prisma.membership.count({
      where: { userId: session.user.id, orgId: { not: id } },
    });
    if (remaining === 0) {
      return NextResponse.json(
        {
          error:
            "Нельзя удалить единственный workspace. Создайте другой и переключитесь, прежде чем удалить этот.",
          code: "LAST_WORKSPACE",
        },
        { status: 400 }
      );
    }

    // If this was the active workspace, switch to one of the user's other
    // workspaces atomically before deletion.
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { activeOrgId: true },
    });
    if (me?.activeOrgId === id) {
      const fallback = await prisma.membership.findFirst({
        where: { userId: session.user.id, orgId: { not: id } },
        orderBy: { createdAt: "asc" },
      });
      if (fallback) {
        await prisma.user.update({
          where: { id: session.user.id },
          data: { activeOrgId: fallback.orgId },
        });
      }
    }

    await prisma.organization.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof OrgAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    await reportError(error, { op: "organizations.delete" });
    return NextResponse.json(
      { error: "Не удалось удалить workspace" },
      { status: 500 }
    );
  }
}
