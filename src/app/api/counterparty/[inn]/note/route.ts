import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureActiveOrg } from "@/lib/org";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  props: { params: Promise<{ inn: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId =
      session.user.activeOrgId ?? (await ensureActiveOrg(session.user.id));
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

    const profile = await prisma.counterpartyProfile.findUnique({
      where: { inn },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Counterparty not found" },
        { status: 404 }
      );
    }

    // Notes are per-user (see CounterpartyCheck.@@unique in schema for why
    // we kept the per-user key). orgId is still tracked so future per-org
    // aggregations work; the upsert is keyed by (userId, inn).
    const check = await prisma.counterpartyCheck.upsert({
      where: {
        userId_inn: { userId: session.user.id, inn },
      },
      create: {
        userId: session.user.id,
        orgId,
        inn,
        notes: note,
      },
      update: {
        orgId,
        notes: note,
      },
    });

    return NextResponse.json({ check });
  } catch (error) {
    console.error("Note update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
