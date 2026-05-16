import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  connectionStates,
  NETWORK_USER_SELECT,
  shapeNetworkUser,
} from "@/lib/network";
import { validateInn } from "@/lib/inn";
import { reportError } from "@/lib/telemetry";

// GET /api/network/by-inn/[inn] — resolve a counterparty ИНН to the
// ЮрИИст account that linked it, so a user checking a counterparty can
// reach its representative directly.
//
// Surfacing the account is gated by the owner having explicitly linked
// this ИНН (claimed / verified) — that link is itself an opt-in to being
// reachable as this company. Contact still goes through a connection
// request the owner can decline, so this can't be used for spam.
export async function GET(
  request: Request,
  props: { params: Promise<{ inn: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const me = session.user.id;

    const { inn: rawInn } = await props.params;
    const check = validateInn(rawInn);
    if (!check.valid) return NextResponse.json({ owner: null });
    const inn = check.normalized;

    const link = await prisma.userProfile.findFirst({
      where: {
        inn,
        innStatus: { in: ["claimed", "verified"] },
        NOT: { userId: me },
      },
      select: { userId: true, innStatus: true },
    });
    if (!link) return NextResponse.json({ owner: null });

    const user = await prisma.user.findUnique({
      where: { id: link.userId },
      select: NETWORK_USER_SELECT,
    });
    if (!user) return NextResponse.json({ owner: null });

    const states = await connectionStates(me, [link.userId]);
    return NextResponse.json({
      owner: {
        ...shapeNetworkUser(user),
        innStatus: link.innStatus,
        connection: states.get(link.userId) ?? "none",
      },
    });
  } catch (error) {
    await reportError(error, { op: "network.by-inn" });
    // A lookup failure shouldn't break the counterparty page — just hide
    // the contact card.
    return NextResponse.json({ owner: null });
  }
}
