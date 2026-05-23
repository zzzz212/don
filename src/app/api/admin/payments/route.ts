import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireAdmin, AdminAccessError } from "@/lib/admin";
import { reportError } from "@/lib/telemetry";

// GET /api/admin/payments?status=&plan=&q=&page=
//
// Paginated payment ledger with totals. Useful for support ("did this
// payment go through?"), revenue accounting, and fraud detection. The
// totals row at the top respects the same filter set as the rows so
// "Общая сумма по фильтру" makes sense.

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    requireAdmin(session?.user?.id);

    const url = new URL(request.url);
    const statusFilter = (url.searchParams.get("status") ?? "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const planFilter = (url.searchParams.get("plan") ?? "")
      .split(",")
      .map((p) => p.trim().toUpperCase())
      .filter(Boolean);
    const q = (url.searchParams.get("q") ?? "").trim();
    const page = Math.max(
      1,
      parseInt(url.searchParams.get("page") ?? "1", 10) || 1
    );

    const where: Prisma.PaymentWhereInput = {};
    if (statusFilter.length > 0) where.status = { in: statusFilter };
    if (planFilter.length > 0) where.plan = { in: planFilter };
    if (q.length > 0) {
      where.OR = [
        { customerEmail: { contains: q, mode: "insensitive" } },
        { user: { email: { contains: q, mode: "insensitive" } } },
        { user: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [total, succeededAgg, rows] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.aggregate({
        where: { ...where, status: "SUCCEEDED" },
        _sum: { amountKopecks: true },
        _count: true,
      }),
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          plan: true,
          amountKopecks: true,
          currency: true,
          status: true,
          failureReason: true,
          createdAt: true,
          succeededAt: true,
          customerEmail: true,
          providerPaymentId: true,
          orgId: true,
          user: {
            select: { id: true, email: true, name: true },
          },
          organization: {
            select: { id: true, name: true },
          },
        },
      }),
    ]);

    return NextResponse.json({
      total,
      page,
      pageSize: PAGE_SIZE,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      filteredRevenue: {
        succeededRub: Math.round(
          (succeededAgg._sum.amountKopecks ?? 0) / 100
        ),
        succeededCount: succeededAgg._count,
      },
      payments: rows.map((p) => ({
        id: p.id,
        plan: p.plan,
        amountRub: Math.round(p.amountKopecks / 100),
        currency: p.currency,
        status: p.status,
        failureReason: p.failureReason,
        createdAt: p.createdAt.toISOString(),
        succeededAt: p.succeededAt ? p.succeededAt.toISOString() : null,
        customerEmail: p.customerEmail,
        providerPaymentId: p.providerPaymentId,
        user: p.user,
        org: p.organization,
      })),
    });
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    await reportError(error, { op: "admin.payments" });
    return NextResponse.json(
      { error: "Не удалось загрузить платежи" },
      { status: 500 }
    );
  }
}
