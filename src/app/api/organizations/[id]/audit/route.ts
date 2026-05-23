import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { OrgAccessError, requireMembership } from "@/lib/org";
import { reportError } from "@/lib/telemetry";

// GET /api/organizations/[id]/audit?action=&page=&actorId=
//
// Audit log for the workspace. ADMIN+ only — regular MEMBERs don't see
// who-did-what (privacy). The list shows actor (User), action, target,
// payload (small JSON pretty-printed), IP, timestamp.

const PAGE_SIZE = 50;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: orgId } = await params;
    await requireMembership(session.user.id, orgId, "ADMIN");

    const url = new URL(request.url);
    const actionFilter = (url.searchParams.get("action") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const actorId = url.searchParams.get("actorId")?.trim() ?? "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);

    const where: Prisma.AuditEventWhereInput = { orgId };
    if (actionFilter.length > 0) where.action = { in: actionFilter };
    if (actorId) where.userId = actorId;

    const [total, rows] = await Promise.all([
      prisma.auditEvent.count({ where }),
      prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          action: true,
          target: true,
          targetType: true,
          payload: true,
          ip: true,
          userAgent: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      total,
      page,
      pageSize: PAGE_SIZE,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      events: rows.map((e) => ({
        id: e.id,
        action: e.action,
        target: e.target,
        targetType: e.targetType,
        payload: e.payload,
        ip: e.ip,
        // Trim user-agent for the table view; full string is in `payload`
        // for support if needed.
        userAgent: e.userAgent ? e.userAgent.slice(0, 80) : null,
        createdAt: e.createdAt.toISOString(),
        actor: e.user,
      })),
    });
  } catch (error) {
    if (error instanceof OrgAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    await reportError(error, { op: "audit.list" });
    return NextResponse.json(
      { error: "Не удалось загрузить журнал" },
      { status: 500 }
    );
  }
}
