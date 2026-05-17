import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureProfile, networkRateLimitOk } from "@/lib/network";
import { validateInn } from "@/lib/inn";
import { fetchFromDaData, isDaDataConfigured } from "@/lib/dadata";
import { logAudit, attribution } from "@/lib/audit";
import { reportError } from "@/lib/telemetry";

const ClaimSchema = z.object({ inn: z.string().min(1).max(40) });

// POST /api/network/profile/inn — link an ИНН to the profile.
//
// Tier-1 ("claimed"): the ИНН must pass checksum validation and, when
// DaData is configured, must resolve to a real company / ИП. One ИНН can
// be linked to a single account — enforced here in code, not as a DB
// unique (foot-gun #2). Tier-2 ("verified") is a separate admin step
// after the user uploads an extract.
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const me = session.user.id;
    if (!(await networkRateLimitOk(me))) {
      return NextResponse.json(
        { error: "Слишком много действий подряд. Подождите минуту." },
        { status: 429 }
      );
    }

    const parsed = ClaimSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Введите ИНН" }, { status: 400 });
    }

    const check = validateInn(parsed.data.inn);
    if (!check.valid) {
      return NextResponse.json(
        { error: check.error ?? "Некорректный ИНН" },
        { status: 400 }
      );
    }
    const inn = check.normalized;

    // Anti-squatting: "claimed" is a non-exclusive self-declaration —
    // anyone may state an ИНН (a public extract proves nothing), so a
    // squatter can't lock the real owner out. Only a *verified*
    // ownership — proven by a payment from the company's bank account —
    // is exclusive and blocks the ИНН for everyone else.
    const verifiedElsewhere = await prisma.userProfile.findFirst({
      where: { inn, innStatus: "verified", NOT: { userId: me } },
      select: { id: true },
    });
    if (verifiedElsewhere) {
      return NextResponse.json(
        { error: "Этот ИНН уже подтверждён другим аккаунтом" },
        { status: 409 }
      );
    }

    // Resolve the official name via DaData. When DaData is configured and
    // returns nothing, the ИНН doesn't exist — reject. When DaData isn't
    // configured we can't tell, so we allow the claim with no name (the
    // "verified" tier still requires a human-reviewed document).
    let companyName: string | null = null;
    if (isDaDataConfigured()) {
      const company = await fetchFromDaData(inn).catch(() => null);
      if (!company) {
        return NextResponse.json(
          { error: "Компания или ИП с таким ИНН не найдены в реестре" },
          { status: 404 }
        );
      }
      companyName = company.shortName || company.name;
    }

    await ensureProfile(me);
    const profile = await prisma.userProfile.update({
      where: { userId: me },
      data: {
        inn,
        innStatus: "claimed",
        innCompanyName: companyName,
        innClaimedAt: new Date(),
        // Re-linking resets any prior verification / pending document.
        innVerifiedAt: null,
        innDocUrl: null,
        innDocKey: null,
        innRejectionNote: null,
      },
    });

    void logAudit({
      orgId: null,
      userId: me,
      action: "inn.claimed",
      target: inn,
      targetType: "user",
      payload: { kind: check.kind, hasName: companyName !== null },
      ...attribution(request),
    });

    return NextResponse.json({ profile });
  } catch (error) {
    await reportError(error, { op: "network.profile.inn.claim" });
    return NextResponse.json(
      { error: "Не удалось привязать ИНН" },
      { status: 500 }
    );
  }
}

// DELETE /api/network/profile/inn — unlink the ИНН from the profile.
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const me = session.user.id;

    const current = await prisma.userProfile.findUnique({
      where: { userId: me },
      select: { inn: true },
    });

    await ensureProfile(me);
    const profile = await prisma.userProfile.update({
      where: { userId: me },
      data: {
        inn: null,
        innStatus: "none",
        innCompanyName: null,
        innClaimedAt: null,
        innVerifiedAt: null,
        innDocUrl: null,
        innDocKey: null,
        innRejectionNote: null,
      },
    });

    if (current?.inn) {
      void logAudit({
        orgId: null,
        userId: me,
        action: "inn.unlinked",
        target: current.inn,
        targetType: "user",
        ...attribution(request),
      });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    await reportError(error, { op: "network.profile.inn.unlink" });
    return NextResponse.json(
      { error: "Не удалось отвязать ИНН" },
      { status: 500 }
    );
  }
}
