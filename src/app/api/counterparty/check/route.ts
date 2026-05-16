import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  fetchFromEgrul,
  fetchCourtData,
  fetchDebtData,
  calculateRiskScore,
} from "@/lib/counterparty";
import { fetchFromDaData, fetchDaDataFinance } from "@/lib/dadata";
import { ensureActiveOrg } from "@/lib/org";
import { NextResponse } from "next/server";
import { captureEvent } from "@/lib/analytics/server";

export async function POST(request: Request) {
  try {
    const session = await auth();
    const isDemo = process.env.NODE_ENV === "development" && process.env.DEMO_MODE !== "false";

    // Require auth in production, allow demo in development
    if (!isDemo && !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { inn, forceRefresh } = body;

    if (!inn || typeof inn !== "string" || !/^\d{10,12}$/.test(inn)) {
      return NextResponse.json({ error: "Invalid INN format" }, { status: 400 });
    }

    console.log(`[Counterparty] Checking INN ${inn} (forceRefresh=${!!forceRefresh})`);
    console.log(`[Counterparty] DADATA_API_KEY=${process.env.DADATA_API_KEY ? "SET" : "NOT SET"}, DADATA_SECRET_KEY=${process.env.DADATA_SECRET_KEY ? "SET" : "NOT SET"}`);

    // Check if profile exists and is fresh (< 30 days)
    let profile = await prisma.counterpartyProfile.findUnique({
      where: { inn },
    });

    const isStale =
      forceRefresh ||
      !profile ||
      profile.dataSource === "mock" ||
      (profile.lastUpdated &&
        Date.now() - profile.lastUpdated.getTime() > 30 * 24 * 60 * 60 * 1000);

    console.log(`[Counterparty] Profile found=${!!profile}, dataSource=${profile?.dataSource || "none"}, isStale=${isStale}`);

    if (isStale) {
      // Fetch fresh data from external sources
      // Try DaData first (primary), fallback to ЕГРЮЛ, then mock
      let dataSource = "mock";
      let daDataResult = null;
      let egrulData = null;

      try {
        daDataResult = await fetchFromDaData(inn);
        if (daDataResult) {
          dataSource = "dadata";
        }
      } catch (error) {
        console.error("DaData error:", error);
      }

      if (!daDataResult) {
        try {
          egrulData = await fetchFromEgrul(inn);
          if (egrulData && egrulData.name) {
            dataSource = "egrul";
          }
        } catch (error) {
          console.error("ЕГРЮЛ error:", error);
        }
      } else {
        egrulData = {
          name: daDataResult.name,
          organizationType: daDataResult.organizationType,
          registrationDate: daDataResult.registrationDate,
          address: daDataResult.address,
          okved: daDataResult.okved,
          capitalSize: daDataResult.capitalSize,
          statusCode: daDataResult.statusCode,
        };
      }

      // Try to get extended financial data from DaData (if secret key configured)
      let financeData = null;
      try {
        financeData = await fetchDaDataFinance(inn);
      } catch (error) {
        console.error("DaData finance error:", error);
      }

      const courtData = await fetchCourtData(inn);
      // ФССП searches a legal entity by name — pass the resolved company
      // name so the real provider can query; without it, it returns null
      // and the chain falls back to the stub.
      const debtData = await fetchDebtData(inn, egrulData?.name);

      // Use real DaData finance data if available, fallback to mock
      const debtFound = financeData?.debt ? financeData.debt > 0 : debtData.found;
      const debtAmount = financeData?.debt
        ? BigInt(Math.round(financeData.debt))
        : debtData.amount;

      const riskCalc = calculateRiskScore({
        registrationDate: egrulData?.registrationDate,
        statusCode: egrulData?.statusCode,
        activeLawsuits: courtData.activeLawsuits,
        completedLawsuits: courtData.completedLawsuits,
        lossesCount: courtData.lossesCount,
        debtFound,
        debtAmount,
      });

      const debtSources = financeData?.debt
        ? ["DaData (финансовые данные)"]
        : debtData.sources;

      // Upsert profile
      profile = await prisma.counterpartyProfile.upsert({
        where: { inn },
        create: {
          inn,
          name: egrulData?.name || `ИНН ${inn}`,
          organizationType: egrulData?.organizationType,
          registrationDate: egrulData?.registrationDate
            ? new Date(egrulData.registrationDate)
            : null,
          address: egrulData?.address,
          okved: egrulData?.okved,
          capitalSize: egrulData?.capitalSize,
          statusCode: egrulData?.statusCode,
          activeLawsuits: courtData.activeLawsuits,
          completedLawsuits: courtData.completedLawsuits,
          lossesCount: courtData.lossesCount,
          debtFound,
          debtAmount,
          debtSources: JSON.stringify(debtSources),
          riskScore: riskCalc.score,
          riskLevel: riskCalc.level,
          riskFactors: JSON.stringify(riskCalc.factors),
          dataSource,
        },
        update: {
          name: egrulData?.name || undefined,
          organizationType: egrulData?.organizationType,
          registrationDate: egrulData?.registrationDate
            ? new Date(egrulData.registrationDate)
            : undefined,
          address: egrulData?.address,
          okved: egrulData?.okved,
          capitalSize: egrulData?.capitalSize,
          statusCode: egrulData?.statusCode,
          activeLawsuits: courtData.activeLawsuits,
          completedLawsuits: courtData.completedLawsuits,
          lossesCount: courtData.lossesCount,
          debtFound,
          debtAmount,
          debtSources: JSON.stringify(debtSources),
          riskScore: riskCalc.score,
          riskLevel: riskCalc.level,
          riskFactors: JSON.stringify(riskCalc.factors),
          dataSource,
          lastUpdated: new Date(),
        },
      });
    }

    // Save check history (only if authenticated). Dedup stays per-user
    // (see CounterpartyCheck.@@unique in schema for why). orgId is still
    // recorded so future per-workspace aggregations work; only the
    // upsert key is per-user.
    if (session?.user?.id) {
      const orgId =
        session.user.activeOrgId ?? (await ensureActiveOrg(session.user.id));

      await prisma.counterpartyCheck.upsert({
        where: {
          userId_inn: {
            userId: session.user.id,
            inn,
          },
        },
        create: {
          userId: session.user.id,
          orgId,
          inn,
        },
        update: {
          orgId,
          createdAt: new Date(),
        },
      });
    }

    if (!profile) {
      return NextResponse.json(
        { error: "Failed to create or retrieve profile" },
        { status: 500 }
      );
    }

    const responseProfile = {
      ...profile,
      debtAmount: profile.debtAmount ? profile.debtAmount.toString() : null,
      debtSources: JSON.parse(profile.debtSources),
      riskFactors: JSON.parse(profile.riskFactors),
    };

    console.log(`[Counterparty] Response: name="${responseProfile.name}", source=${responseProfile.dataSource}, status=${responseProfile.statusCode}`);

    void captureEvent({
      userId: session?.user?.id ?? null,
      event: "counterparty_checked",
      properties: {
        riskLevel: responseProfile.riskLevel,
        riskScore: responseProfile.riskScore,
        dataSource: responseProfile.dataSource,
      },
    });

    return NextResponse.json({ profile: responseProfile });
  } catch (error) {
    console.error("Counterparty check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
