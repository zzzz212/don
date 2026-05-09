import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { OrgAccessError, requireMembership, type Role } from "@/lib/org";
import { reportError } from "@/lib/telemetry";

const VALID_ROLES: Role[] = ["OWNER", "ADMIN", "MEMBER"];

// PATCH /api/organizations/[id]/members/[userId]  { role }
//   Change a member's role. OWNER only — granting OWNER must come from an
//   existing OWNER, and demoting an OWNER could leave the org ownerless.
//   We refuse to demote the last OWNER.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: orgId, userId: targetUserId } = await params;
    await requireMembership(session.user.id, orgId, "OWNER");

    const body = (await request.json().catch(() => ({}))) as {
      role?: unknown;
    };
    const newRole =
      typeof body.role === "string" && (VALID_ROLES as string[]).includes(body.role)
        ? (body.role as Role)
        : null;
    if (!newRole) {
      return NextResponse.json(
        { error: "role must be OWNER | ADMIN | MEMBER" },
        { status: 400 }
      );
    }

    // Look up the target membership scoped to this org (404 if foreign).
    const target = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: targetUserId, orgId } },
    });
    if (!target) {
      return NextResponse.json(
        { error: "Участник не найден" },
        { status: 404 }
      );
    }

    // Refuse to demote the last OWNER — would leave the workspace ownerless.
    if (target.role === "OWNER" && newRole !== "OWNER") {
      const remainingOwners = await prisma.membership.count({
        where: { orgId, role: "OWNER", userId: { not: targetUserId } },
      });
      if (remainingOwners === 0) {
        return NextResponse.json(
          {
            error: "Нельзя понизить роль последнего владельца workspace",
            code: "LAST_OWNER",
          },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.membership.update({
      where: { userId_orgId: { userId: targetUserId, orgId } },
      data: { role: newRole },
    });

    return NextResponse.json({
      userId: updated.userId,
      role: updated.role,
    });
  } catch (error) {
    if (error instanceof OrgAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    await reportError(error, { op: "members.patch" });
    return NextResponse.json(
      { error: "Не удалось обновить роль" },
      { status: 500 }
    );
  }
}

// DELETE /api/organizations/[id]/members/[userId]
//   Remove a member from the workspace. ADMIN+ can remove MEMBERs; OWNER
//   can remove ADMINs; nobody can remove the last OWNER. Members can remove
//   themselves (leave the workspace) regardless of role, except the last
//   OWNER (same rule).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: orgId, userId: targetUserId } = await params;
    const me = await requireMembership(session.user.id, orgId, "MEMBER");

    const removingSelf = targetUserId === session.user.id;

    // If the requester isn't removing themselves, they must outrank the
    // target. ADMIN+ can remove MEMBERs; OWNER can remove ADMINs and OWNERs.
    if (!removingSelf) {
      if (me.role === "MEMBER") {
        return NextResponse.json(
          { error: "Только админы могут удалять участников" },
          { status: 403 }
        );
      }

      const target = await prisma.membership.findUnique({
        where: { userId_orgId: { userId: targetUserId, orgId } },
      });
      if (!target) {
        return NextResponse.json(
          { error: "Участник не найден" },
          { status: 404 }
        );
      }

      // ADMIN cannot remove ADMIN or OWNER — only MEMBER.
      if (me.role === "ADMIN" && target.role !== "MEMBER") {
        return NextResponse.json(
          {
            error: "Админ может удалить только обычного участника",
            code: "INSUFFICIENT_ROLE",
          },
          { status: 403 }
        );
      }
    }

    // Block removing the last OWNER even when self-leaving.
    const targetMembership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: targetUserId, orgId } },
    });
    if (!targetMembership) {
      return NextResponse.json(
        { error: "Участник не найден" },
        { status: 404 }
      );
    }
    if (targetMembership.role === "OWNER") {
      const remainingOwners = await prisma.membership.count({
        where: { orgId, role: "OWNER", userId: { not: targetUserId } },
      });
      if (remainingOwners === 0) {
        return NextResponse.json(
          {
            error:
              "Нельзя удалить последнего владельца. Передайте права другому участнику или удалите весь workspace.",
            code: "LAST_OWNER",
          },
          { status: 400 }
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.membership.delete({
        where: { userId_orgId: { userId: targetUserId, orgId } },
      });
      // If the removed user had this org as their active workspace, swap
      // them to any other org they belong to so they don't end up stuck.
      if (removingSelf || targetMembership.role) {
        const target = await tx.user.findUnique({
          where: { id: targetUserId },
          select: { activeOrgId: true },
        });
        if (target?.activeOrgId === orgId) {
          const fallback = await tx.membership.findFirst({
            where: { userId: targetUserId, orgId: { not: orgId } },
            orderBy: { createdAt: "asc" },
          });
          await tx.user.update({
            where: { id: targetUserId },
            data: { activeOrgId: fallback?.orgId ?? null },
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof OrgAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    await reportError(error, { op: "members.delete" });
    return NextResponse.json(
      { error: "Не удалось удалить участника" },
      { status: 500 }
    );
  }
}
