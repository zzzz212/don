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

    // Notes are workspace-shared: any team member sees and updates the same
    // notes for an INN the org has previously checked. (orgId, inn) is the
    // unique key.
    const check = await prisma.counterpartyCheck.upsert({
      where: {
        orgId_inn: { orgId, inn },
      },
      create: {
        userId: session.user.id,
        orgId,
        inn,
        notes: note,
      },
      update: {
        notes: note,
        // Track who most recently edited the note.
        userId: session.user.id,
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
