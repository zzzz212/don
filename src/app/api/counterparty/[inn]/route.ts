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

    return NextResponse.json({
      profile: {
        ...profile,
        debtSources: JSON.parse(profile.debtSources),
        riskFactors: JSON.parse(profile.riskFactors),
      },
    });
  } catch (error) {
    console.error("Counterparty fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
