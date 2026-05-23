import { randomBytes } from "crypto";
import { cookies } from "next/headers";

// Cookie name for the anonymous receiver session. Scoped to /deal/
// paths in the route handlers (Next 16 cookie API). 128 bits is enough
// for an opaque session id — not used for authentication, only to bind
// repeat actions on the same DealParticipant.
export const DEAL_SESSION_COOKIE = "yakso_deal_session";

export function generateDealSessionId(): string {
  return randomBytes(16).toString("hex");
}

// Read the deal session id from cookies, creating a new one if absent.
// MUST be called from a route handler or server action (Next 16 cookies
// API requires async access). Returns the sessionId and a flag
// indicating whether a new id was just minted (caller may want to set
// the cookie on the response in that case).
export async function getOrCreateDealSessionId(): Promise<{
  sessionId: string;
  isNew: boolean;
}> {
  const jar = await cookies();
  const existing = jar.get(DEAL_SESSION_COOKIE)?.value;
  if (existing && /^[0-9a-f]{32}$/.test(existing)) {
    return { sessionId: existing, isNew: false };
  }
  const sessionId = generateDealSessionId();
  jar.set(DEAL_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/deal",
    // 90 days — long enough for a multi-week negotiation, short enough
    // that abandoned sessions eventually expire.
    maxAge: 60 * 60 * 24 * 90,
    secure: process.env.NODE_ENV === "production",
  });
  return { sessionId, isNew: true };
}
