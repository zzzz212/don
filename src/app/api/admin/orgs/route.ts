import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireAdmin, AdminAccessError } from "@/lib/admin";
import { reportError } from "@/lib/telemetry";

// GET /api/admin/orgs?q=&plan=&page=
//
// Paginated workspace list. Each row carries owner (first OWNER
// membership), member count, plan, trial state, and subscription
// status if any. Sorted by createdAt desc.

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
    const page = Math.max(
      1,
      parseInt(url.searchParams.get("page") ?? "1", 10) || 1
    );

    const where: Prisma.OrganizationWhereInput = {};
    if (planFilter.length > 0) where.plan = { in: planFilter };
    if (q.length > 0) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        {
          memberships: {
            some: {
              user: { email: { contains: q, mode: "insensitive" } },
            },
          },
        },
      ];
    }

    const [total, rows] = await Promise.all([
      prisma.organization.count({ where }),
      prisma.organization.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          trialEndsAt: true,
          createdAt: true,
          _count: { select: { memberships: true, documents: true } },
          memberships: {
            where: { role: "OWNER" },
            take: 1,
            select: {
              user: { select: { id: true, email: true, name: true } },
            },
          },
          subscription: {
            select: {
              plan: true,
              status: true,
              currentPeriodEnd: true,
              cancelAtPeriodEnd: true,
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
      orgs: rows.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        plan: o.plan,
        trialEndsAt: o.trialEndsAt ? o.trialEndsAt.toISOString() : null,
        onActiveTrial: !!o.trialEndsAt && o.trialEndsAt.getTime() > now.getTime(),
        createdAt: o.createdAt.toISOString(),
        memberCount: o._count.memberships,
        documentCount: o._count.documents,
        owner: o.memberships[0]?.user ?? null,
        subscription: o.subscription
          ? {
              plan: o.subscription.plan,
              status: o.subscription.status,
              currentPeriodEnd:
                o.subscription.currentPeriodEnd.toISOString(),
              cancelAtPeriodEnd: o.subscription.cancelAtPeriodEnd,
            }
          : null,
      })),
    });
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    await reportError(error, { op: "admin.orgs" });
    return NextResponse.json(
      { error: "Не удалось загрузить workspaces" },
      { status: 500 }
    );
  }
}
