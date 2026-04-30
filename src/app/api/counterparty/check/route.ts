import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  fetchFromEgrul,
  fetchCourtData,
  fetchDebtData,
  calculateRiskScore,
} from "@/lib/counterparty";
import { fetchFromDaData, fetchDaDataFinance } from "@/lib/dadata";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const session = await auth();
    const isDemo = process.env.NODE_ENV === "development" && process.env.DEMO_MODE !== "false";

    // Require auth in production, allow demo in development
    if (!isDemo && !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { inn } = body;

    if (!inn || typeof inn !== "string" || !/^\d{10,12}$/.test(inn)) {
      return NextResponse.json({ error: "Invalid INN format" }, { status: 400 });
    }

    // Check if profile exists and is fresh (< 30 days)
    let profile = await prisma.counterpartyProfile.findUnique({
      where: { inn },
    });

    const isStale =
      !profile ||
      (profile.lastUpdated &&
        Date.now() - profile.lastUpdated.getTime() > 30 * 24 * 60 * 60 * 1000);

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
      const debtData = await fetchDebtData(inn);

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

    // Save check history (only if authenticated)
    if (session?.user?.id) {
      await prisma.counterpartyCheck.upsert({
        where: {
          userId_inn: {
            userId: session.user.id,
            inn,
          },
        },
        create: {
          userId: session.user.id,
          inn,
        },
        update: {
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

    return NextResponse.json({
      profile: {
        ...profile,
        debtAmount: profile.debtAmount ? profile.debtAmount.toString() : null,
        debtSources: JSON.parse(profile.debtSources),
        riskFactors: JSON.parse(profile.riskFactors),
      },
    });
  } catch (error) {
    console.error("Counterparty check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
