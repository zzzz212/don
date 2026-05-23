import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateReferralCode, REFERRAL_BONUS } from "@/lib/referral";
import { BRAND } from "@/lib/legal-info";
import { reportError } from "@/lib/telemetry";

// GET /api/referral — the signed-in user's referral code, share link,
// bonus balance and headline stats. Mints a code lazily for accounts
// that predate the referral programme.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const me = session.user.id;

    const user = await prisma.user.findUnique({
      where: { id: me },
      select: { referralCode: true, bonusAnalyses: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Аккаунт не найден" }, { status: 404 });
    }

    let code = user.referralCode;
    if (!code) {
      code = await generateReferralCode();
      await prisma.user.update({
        where: { id: me },
        data: { referralCode: code },
      });
    }

    const [referredCount, activatedCount] = await Promise.all([
      prisma.user.count({ where: { referredById: me } }),
      prisma.user.count({
        where: { referredById: me, trialActivatedAt: { not: null } },
      }),
    ]);

    return NextResponse.json({
      code,
      url: `${BRAND.publicUrl}/register?ref=${code}`,
      bonusAnalyses: user.bonusAnalyses,
      bonusPerReferral: REFERRAL_BONUS,
      referredCount,
      activatedCount,
    });
  } catch (error) {
    await reportError(error, { op: "referral.get" });
    return NextResponse.json(
      { error: "Не удалось загрузить реферальные данные" },
      { status: 500 }
    );
  }
}
