import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  fetchFromEgrul,
  fetchCourtData,
  fetchDebtData,
  calculateRiskScore,
} from "@/lib/counterparty";
import { fetchFromDaData } from "@/lib/dadata";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
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
      // Try DaData first, then fallback to ЕГРЮЛ
      const daDataResult = await fetchFromDaData(inn);
      const egrulData = daDataResult ? {
        name: daDataResult.name,
        organizationType: daDataResult.name.split(" ")[0],
        registrationDate: daDataResult.registrationDate,
        address: daDataResult.address,
        okved: undefined,
        capitalSize: daDataResult.capitalSize,
        statusCode: daDataResult.status,
      } : await fetchFromEgrul(inn);

      const courtData = await fetchCourtData(inn);
      const debtData = await fetchDebtData(inn);

      const riskCalc = calculateRiskScore({
        registrationDate: egrulData?.registrationDate,
        statusCode: daDataResult?.status || egrulData?.statusCode,
        activeLawsuits: courtData.activeLawsuits,
        completedLawsuits: courtData.completedLawsuits,
        lossesCount: courtData.lossesCount,
        debtFound: debtData.found,
        debtAmount: debtData.amount,
      });

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
          debtFound: debtData.found,
          debtAmount: debtData.amount,
          debtSources: JSON.stringify(debtData.sources),
          riskScore: riskCalc.score,
          riskLevel: riskCalc.level,
          riskFactors: JSON.stringify(riskCalc.factors),
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
          debtFound: debtData.found,
          debtAmount: debtData.amount,
          debtSources: JSON.stringify(debtData.sources),
          riskScore: riskCalc.score,
          riskLevel: riskCalc.level,
          riskFactors: JSON.stringify(riskCalc.factors),
          lastUpdated: new Date(),
        },
      });
    }

    // Save check history
    await prisma.counterpartyCheck.create({
      data: {
        userId: session.user.id || "",
        inn,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Failed to create or retrieve profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      profile: {
        ...profile,
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
