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
// Яксо account that linked it, so a user checking a counterparty can
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

    // Only a *verified* owner is contactable. A self-declared "claimed"
    // ИНН is not proof of representation — surfacing it for direct
    // contact would let an impostor intercept a company's counterparties.
    const verified = await prisma.userProfile.findFirst({
      where: { inn, innStatus: "verified" },
      select: { userId: true },
    });
    if (verified) {
      if (verified.userId === me) {
        return NextResponse.json({ owner: null, self: true });
      }
      const user = await prisma.user.findUnique({
        where: { id: verified.userId },
        select: NETWORK_USER_SELECT,
      });
      if (user) {
        const states = await connectionStates(me, [verified.userId]);
        return NextResponse.json({
          owner: {
            ...shapeNetworkUser(user),
            innStatus: "verified",
            connection: states.get(verified.userId) ?? "none",
          },
        });
      }
    }

    // No verified owner. Tell the three remaining cases apart so the UI
    // copy is accurate: it's your own ИНН / someone declared it but
    // didn't verify / nobody touched it.
    const mine = await prisma.userProfile.findFirst({
      where: { inn, userId: me, innStatus: { not: "none" } },
      select: { id: true },
    });
    if (mine) return NextResponse.json({ owner: null, self: true });

    const claimed = await prisma.userProfile.findFirst({
      where: { inn, innStatus: "claimed" },
      select: { id: true },
    });
    if (claimed) return NextResponse.json({ owner: null, unverified: true });

    return NextResponse.json({ owner: null });
  } catch (error) {
    await reportError(error, { op: "network.by-inn" });
    // A lookup failure shouldn't break the counterparty page — just hide
    // the contact card.
    return NextResponse.json({ owner: null });
  }
}
