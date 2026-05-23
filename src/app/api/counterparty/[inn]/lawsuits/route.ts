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

    // TODO: Implement actual court data retrieval from КАД API
    // For now return mock data based on profile statistics
    const lawsuits = [
      {
        id: "1",
        caseNumber: "А78-12345/2024",
        title: "Взыскание задолженности",
        status: "рассмотрение",
        amount: 150000,
        date: "2024-01-15",
      },
      {
        id: "2",
        caseNumber: "А78-12346/2024",
        title: "Расторжение контракта",
        status: "завершено",
        amount: 250000,
        date: "2023-11-20",
      },
    ].slice(0, profile.activeLawsuits || 0);

    return NextResponse.json({
      activeLawsuits: profile.activeLawsuits,
      completedLawsuits: profile.completedLawsuits,
      lossesCount: profile.lossesCount,
      lawsuits,
    });
  } catch (error) {
    console.error("Lawsuits fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
