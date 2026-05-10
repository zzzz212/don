// Admin gate.
//
// We use an env-var allowlist of user ids rather than a User.role column
// because:
//   1. Admin status is operational, not product. Adding it to the schema
//      would force a migration + data sync every time we promote/demote
//      someone, and product-shaped fields end up exposed in API responses
//      by accident.
//   2. ADMIN_USER_IDS is a Vercel env var change with no deploy needed
//      (Settings → Environment Variables → Save → Redeploy). Faster
//      iteration during early support.
//
// Format: ADMIN_USER_IDS="cuid1,cuid2,cuid3" — User.id values, not emails.
// User.id is a cuid that's hard to spoof; emails change.

export class AdminAccessError extends Error {
  constructor(message: string = "Доступ только для администраторов") {
    super(message);
    this.name = "AdminAccessError";
  }
}

/**
 * Parse the ADMIN_USER_IDS env var into a normalized set. Whitespace and
 * empty entries are tolerated so a user can write "id1, id2, id3" or
 * "id1,id2," without breaking anything.
 */
export function getAdminUserIds(): Set<string> {
  const raw = process.env.ADMIN_USER_IDS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  );
}

/** Cheap synchronous check — useful in render paths and middleware. */
export function isAdminUserId(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return getAdminUserIds().has(userId);
}

/**
 * Throw AdminAccessError if the user isn't on the allowlist. Use at the
 * top of every /api/admin/* handler. Routes wrap the throw to return 403.
 */
export function requireAdmin(userId: string | null | undefined): void {
  if (!isAdminUserId(userId)) {
    throw new AdminAccessError();
  }
}

/** True iff at least one admin id is configured — useful for surfacing
 *  "no admins configured" hints in the UI early on. */
export function isAdminConfigured(): boolean {
  return getAdminUserIds().size > 0;
}
