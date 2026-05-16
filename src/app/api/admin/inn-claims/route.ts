import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireAdmin, AdminAccessError } from "@/lib/admin";
import { reportError } from "@/lib/telemetry";

// GET /api/admin/inn-claims — the ИНН verification queue: profiles that
// have a linked ИНН ("claimed") and have uploaded an extract awaiting a
// human decision. Oldest first so the queue is FIFO.
export async function GET() {
  try {
    const session = await auth();
    requireAdmin(session?.user?.id);

    const rows = await prisma.userProfile.findMany({
      where: { innStatus: "claimed", innDocUrl: { not: null } },
      orderBy: { updatedAt: "asc" },
      select: {
        userId: true,
        inn: true,
        innCompanyName: true,
        innDocUrl: true,
        innClaimedAt: true,
        updatedAt: true,
        user: { select: { email: true, name: true } },
      },
    });

    return NextResponse.json({
      claims: rows.map((r) => ({
        userId: r.userId,
        email: r.user.email,
        name: r.user.name,
        inn: r.inn,
        companyName: r.innCompanyName,
        documentUrl: r.innDocUrl,
        claimedAt: r.innClaimedAt?.toISOString() ?? null,
        submittedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    await reportError(error, { op: "admin.inn.list" });
    return NextResponse.json(
      { error: "Не удалось загрузить заявки на подтверждение ИНН" },
      { status: 500 }
    );
  }
}
