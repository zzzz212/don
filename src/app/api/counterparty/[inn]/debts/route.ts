import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  props: { params: Promise<{ inn: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await props.params;
    const { inn } = params;

    if (!inn || !/^\d{10,12}$/.test(inn)) {
      return NextResponse.json({ error: "Invalid INN format" }, { status: 400 });
    }

    const profile = await prisma.counterpartyProfile.findUnique({
      where: { inn },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Counterparty not found" },
        { status: 404 }
      );
    }

    // TODO: Implement actual debt data retrieval from ФЕДРЕСУРС/ФССП API
    // For now return mock data based on profile statistics
    const debts = profile.debtFound
      ? [
          {
            id: "1",
            type: "налоги",
            amount: 500000,
            date: "2024-01-10",
            source: "ФНС",
          },
          {
            id: "2",
            type: "штрафы",
            amount: 150000,
            date: "2023-11-15",
            source: "ФССП",
          },
        ]
      : [];

    const debtSources = JSON.parse(profile.debtSources);

    return NextResponse.json({
      debtFound: profile.debtFound,
      totalDebtAmount: profile.debtAmount?.toString() || "0",
      debtSources,
      debts,
    });
  } catch (error) {
    console.error("Debts fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
