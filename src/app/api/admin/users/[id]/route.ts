import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireAdmin, AdminAccessError } from "@/lib/admin";
import { reportError } from "@/lib/telemetry";

// GET /api/admin/users/[id]
//   Detail view for one user — workspaces (owned + member), this-month
//   usage, payment history, trial state. Used by /admin/users/[id].

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    requireAdmin(session?.user?.id);

    const { id } = await params;
    const now = new Date();
    const startOfMonthUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    );
    const thirtyDaysAgo = new Date(now.getTime() - 30 * MS_PER_DAY);

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        activeOrgId: true,
        trialActivatedAt: true,
        plan: true,
        memberships: {
          select: {
            role: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                plan: true,
                trialEndsAt: true,
                createdAt: true,
                _count: { select: { memberships: true } },
                subscription: {
                  select: {
                    plan: true,
                    status: true,
                    currentPeriodEnd: true,
                    cancelAtPeriodEnd: true,
                  },
                },
              },
            },
          },
        },
        accounts: {
          select: { provider: true },
        },
        _count: {
          select: { documents: true, generatedDocuments: true, chats: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    const [usageThisMonth, recentPayments] = await Promise.all([
      prisma.aiUsage.groupBy({
        by: ["feature"],
        where: { userId: id, createdAt: { gte: startOfMonthUtc } },
        _count: true,
      }),
      prisma.payment.findMany({
        where: { userId: id, createdAt: { gte: thirtyDaysAgo } },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          plan: true,
          amountKopecks: true,
          status: true,
          createdAt: true,
          succeededAt: true,
          failureReason: true,
        },
      }),
    ]);

    const usageByFeature: Record<string, number> = {
      analyze: 0,
      generate: 0,
      chat: 0,
      ocr: 0,
    };
    for (const row of usageThisMonth) {
      usageByFeature[row.feature] = row._count;
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      activeOrgId: user.activeOrgId,
      trialActivatedAt: user.trialActivatedAt
        ? user.trialActivatedAt.toISOString()
        : null,
      legacyPlan: user.plan,
      authProviders: user.accounts.map((a) => a.provider),
      counters: {
        documents: user._count.documents,
        generatedDocuments: user._count.generatedDocuments,
        chats: user._count.chats,
      },
      usageThisMonth: usageByFeature,
      memberships: user.memberships.map((m) => ({
        role: m.role,
        org: {
          id: m.organization.id,
          name: m.organization.name,
          slug: m.organization.slug,
          plan: m.organization.plan,
          trialEndsAt: m.organization.trialEndsAt
            ? m.organization.trialEndsAt.toISOString()
            : null,
          createdAt: m.organization.createdAt.toISOString(),
          memberCount: m.organization._count.memberships,
          subscription: m.organization.subscription
            ? {
                plan: m.organization.subscription.plan,
                status: m.organization.subscription.status,
                currentPeriodEnd:
                  m.organization.subscription.currentPeriodEnd.toISOString(),
                cancelAtPeriodEnd:
                  m.organization.subscription.cancelAtPeriodEnd,
              }
            : null,
        },
      })),
      recentPayments: recentPayments.map((p) => ({
        id: p.id,
        plan: p.plan,
        amountRub: Math.round(p.amountKopecks / 100),
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        succeededAt: p.succeededAt ? p.succeededAt.toISOString() : null,
        failureReason: p.failureReason,
      })),
    });
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    await reportError(error, { op: "admin.users.detail" });
    return NextResponse.json(
      { error: "Не удалось загрузить пользователя" },
      { status: 500 }
    );
  }
}
