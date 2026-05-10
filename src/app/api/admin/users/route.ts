import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireAdmin, AdminAccessError } from "@/lib/admin";
import { reportError } from "@/lib/telemetry";

// GET /api/admin/users?q=&page=&plan=&trialActive=
//
// Paginated list of users for the admin panel. Filters:
//   • q          — case-insensitive substring match on email or name
//   • plan       — comma-separated plan codes filtered by their owned
//                  workspaces' plan (FREE/PRO/BUSINESS)
//   • trialActive=true — only users whose owned workspace has an active
//                        trial right now
//   • page       — 1-based page number, 50 per page
//
// Sorted: newest sign-ups first.

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    requireAdmin(session?.user?.id);

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const planFilter = (url.searchParams.get("plan") ?? "")
      .split(",")
      .map((p) => p.trim().toUpperCase())
      .filter(Boolean);
    const trialActive = url.searchParams.get("trialActive") === "true";
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);

    // Build a Prisma where clause incrementally so unspecified filters
    // contribute nothing to the query plan.
    const where: Prisma.UserWhereInput = {};
    if (q.length > 0) {
      where.OR = [
        { email: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ];
    }
    if (planFilter.length > 0 || trialActive) {
      const orgWhere: Prisma.OrganizationWhereInput = {};
      if (planFilter.length > 0) {
        orgWhere.plan = { in: planFilter };
      }
      if (trialActive) {
        orgWhere.trialEndsAt = { gt: new Date() };
      }
      where.memberships = {
        some: {
          role: "OWNER",
          organization: orgWhere,
        },
      };
    }

    const [total, rows] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          trialActivatedAt: true,
          activeOrgId: true,
          memberships: {
            where: { role: "OWNER" },
            select: {
              organization: {
                select: {
                  id: true,
                  name: true,
                  plan: true,
                  trialEndsAt: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const now = new Date();
    return NextResponse.json({
      total,
      page,
      pageSize: PAGE_SIZE,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      users: rows.map((u) => {
        const ownedOrgs = u.memberships.map((m) => m.organization);
        const primaryOrg =
          ownedOrgs.find((o) => o.id === u.activeOrgId) ?? ownedOrgs[0] ?? null;
        const trialEndsAt = primaryOrg?.trialEndsAt ?? null;
        const onActiveTrial = !!trialEndsAt && trialEndsAt.getTime() > now.getTime();
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          createdAt: u.createdAt.toISOString(),
          trialActivatedAt: u.trialActivatedAt
            ? u.trialActivatedAt.toISOString()
            : null,
          ownedWorkspacesCount: ownedOrgs.length,
          primaryWorkspace: primaryOrg
            ? {
                id: primaryOrg.id,
                name: primaryOrg.name,
                plan: primaryOrg.plan,
                trialEndsAt: trialEndsAt
                  ? trialEndsAt.toISOString()
                  : null,
                onActiveTrial,
              }
            : null,
        };
      }),
    });
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    await reportError(error, { op: "admin.users.list" });
    return NextResponse.json(
      { error: "Не удалось загрузить список пользователей" },
      { status: 500 }
    );
  }
}
