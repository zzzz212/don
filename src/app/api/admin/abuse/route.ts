import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireAdmin, AdminAccessError } from "@/lib/admin";
import { reportError } from "@/lib/telemetry";

// GET /api/admin/abuse — multi-account abuse review surface.
//
// Returns:
//   • flagged   — accounts with a non-zero trial-activation risk score
//   • clusters  — signup IPs / device fingerprints shared by several
//                 accounts (the raw material a farmer leaves behind)
//
// Nothing here is auto-enforced — it's a human-review queue (the layered
// anti-abuse policy).
export async function GET() {
  try {
    const session = await auth();
    requireAdmin(session?.user?.id);

    // Multi-member clusters only (HAVING keeps the result set small even
    // as the user table grows).
    const [fpGroups, ipGroups] = await Promise.all([
      prisma.user.groupBy({
        by: ["signupFingerprint"],
        where: { signupFingerprint: { not: null } },
        _count: { _all: true },
        having: { signupFingerprint: { _count: { gte: 2 } } },
      }),
      prisma.user.groupBy({
        by: ["signupIp"],
        where: { signupIp: { not: null } },
        _count: { _all: true },
        having: { signupIp: { _count: { gte: 3 } } },
      }),
    ]);

    const fpSize = new Map<string, number>();
    for (const g of fpGroups) {
      if (g.signupFingerprint) fpSize.set(g.signupFingerprint, g._count._all);
    }
    const ipSize = new Map<string, number>();
    for (const g of ipGroups) {
      if (g.signupIp) ipSize.set(g.signupIp, g._count._all);
    }

    const flagged = await prisma.user.findMany({
      where: { abuseScore: { gt: 0 } },
      orderBy: [{ abuseScore: "desc" }, { createdAt: "desc" }],
      take: 100,
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        signupIp: true,
        signupFingerprint: true,
        abuseScore: true,
        trialActivatedAt: true,
      },
    });

    return NextResponse.json({
      flagged: flagged.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        createdAt: u.createdAt.toISOString(),
        signupIp: u.signupIp,
        fingerprintShort: u.signupFingerprint
          ? u.signupFingerprint.slice(0, 12)
          : null,
        abuseScore: u.abuseScore,
        trialActivated: u.trialActivatedAt !== null,
        ipClusterSize: u.signupIp ? ipSize.get(u.signupIp) ?? 1 : 0,
        fingerprintClusterSize: u.signupFingerprint
          ? fpSize.get(u.signupFingerprint) ?? 1
          : 0,
      })),
      fingerprintClusters: fpGroups
        .filter((g) => g.signupFingerprint)
        .sort((a, b) => b._count._all - a._count._all)
        .slice(0, 25)
        .map((g) => ({
          key: g.signupFingerprint!.slice(0, 12),
          count: g._count._all,
        })),
      ipClusters: ipGroups
        .filter((g) => g.signupIp)
        .sort((a, b) => b._count._all - a._count._all)
        .slice(0, 25)
        .map((g) => ({ key: g.signupIp!, count: g._count._all })),
    });
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    await reportError(error, { op: "admin.abuse.list" });
    return NextResponse.json(
      { error: "Не удалось загрузить данные анти-абуза" },
      { status: 500 }
    );
  }
}
