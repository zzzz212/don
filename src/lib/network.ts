// Cross-user network helpers — shared by the /api/network/* routes.
// The network is a layer above workspaces: opt-in discoverable profiles,
// user-to-user connections, document review shares and direct messages.

import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

/** Lazily create the network profile row for a user. A profile exists
 *  as soon as the user opens the network section; `discoverable` stays
 *  false until they explicitly opt into the catalogue (152-ФЗ). */
export async function ensureProfile(userId: string) {
  return prisma.userProfile.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

/** Deterministic key for a 1:1 conversation, independent of who opens
 *  it — the two ids sorted so a pair always maps to exactly one row. */
export function conversationPairKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}

// State of the connection between the current user and another user,
// expressed from the current user's point of view.
export type ConnectionState =
  | "none"
  | "connected"
  | "incoming" // they sent me a request
  | "outgoing" // I sent them a request
  | "declined";

/** Resolve the connection state between `me` and each id in `otherIds`
 *  in one query. Returns a Map keyed by the other user's id; ids with
 *  no connection row are simply absent (caller defaults to "none"). */
export async function connectionStates(
  me: string,
  otherIds: string[]
): Promise<Map<string, ConnectionState>> {
  const out = new Map<string, ConnectionState>();
  if (otherIds.length === 0) return out;

  const rows = await prisma.connection.findMany({
    where: {
      OR: [
        { requesterId: me, addresseeId: { in: otherIds } },
        { addresseeId: me, requesterId: { in: otherIds } },
      ],
    },
  });

  for (const c of rows) {
    const other = c.requesterId === me ? c.addresseeId : c.requesterId;
    if (c.status === "ACCEPTED") out.set(other, "connected");
    else if (c.status === "DECLINED") out.set(other, "declined");
    else if (c.requesterId === me) out.set(other, "outgoing");
    else out.set(other, "incoming");
  }
  return out;
}

/** True when `a` and `b` have an ACCEPTED connection. Gates messaging
 *  and document sharing — you can only reach people you connected with. */
export async function areConnected(a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  const c = await prisma.connection.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: a, addresseeId: b },
        { requesterId: b, addresseeId: a },
      ],
    },
    select: { id: true },
  });
  return c !== null;
}

// Prisma `select` for the user fields a network card needs. profile is a
// left join — a user may not have opened the network section yet.
export const NETWORK_USER_SELECT = {
  id: true,
  name: true,
  image: true,
  profile: { select: { displayName: true, headline: true } },
} as const;

export type NetworkUser = {
  id: string;
  name: string | null;
  image: string | null;
  profile: { displayName: string | null; headline: string | null } | null;
};

/** Collapse a user row into the public-facing shape used across the
 *  network UI — display name falls back from profile to account name. */
export function shapeNetworkUser(u: NetworkUser) {
  return {
    userId: u.id,
    displayName: u.profile?.displayName ?? u.name ?? "Пользователь",
    headline: u.profile?.headline ?? null,
    image: u.image,
  };
}

/** Per-user rate-limit gate for network mutations — connection requests,
 *  shares, comments and messages. Returns false when the user is over
 *  the limit; the caller should answer 429. Keyed by user id, not IP,
 *  so a shared office network isn't throttled as one actor. */
export async function networkRateLimitOk(userId: string): Promise<boolean> {
  const { ok } = await rateLimit(userId, "network");
  return ok;
}
