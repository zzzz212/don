import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(
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
    const body = await request.json();
    const { note } = body;

    if (!inn || !/^\d{10,12}$/.test(inn)) {
      return NextResponse.json({ error: "Invalid INN format" }, { status: 400 });
    }

    if (!note || typeof note !== "string") {
      return NextResponse.json({ error: "Invalid note" }, { status: 400 });
    }

    // Check if profile exists
    const profile = await prisma.counterpartyProfile.findUnique({
      where: { inn },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Counterparty not found" },
        { status: 404 }
      );
    }

    // Get or create check, then update with note
    const userId = session.user.id || "";
    let check = await prisma.counterpartyCheck.findUnique({
      where: {
        userId_inn: {
          userId,
          inn,
        },
      },
    });

    if (!check) {
      check = await prisma.counterpartyCheck.create({
        data: {
          userId,
          inn,
          notes: note,
        },
      });
    } else {
      check = await prisma.counterpartyCheck.update({
        where: {
          userId_inn: {
            userId,
            inn,
          },
        },
        data: {
          notes: note,
        },
      });
    }

    return NextResponse.json({ check });
  } catch (error) {
    console.error("Note update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
