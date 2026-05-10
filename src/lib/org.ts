// Workspace context — the org-scope equivalent of "auth state". Every
// authenticated request resolves which Organization the user is acting in,
// and every shared resource (Document, Chat, etc.) is read/written through
// that org's WHERE clause.
//
// Existing single-user installations are migrated lazily: the first time a
// pre-workspaces user signs in, ensureActiveOrg() creates a personal
// workspace, makes them OWNER, and back-fills all of their existing data
// into it inside one transaction. No batch migration job needed.

import { prisma } from "@/lib/db";

export type Role = "OWNER" | "ADMIN" | "MEMBER";

export const ROLES: Role[] = ["OWNER", "ADMIN", "MEMBER"];

const ROLE_RANK: Record<Role, number> = {
  OWNER: 3,
  ADMIN: 2,
  MEMBER: 1,
};

/** True when `held` is at least as privileged as `required`. */
export function roleAtLeast(held: Role, required: Role): boolean {
  return ROLE_RANK[held] >= ROLE_RANK[required];
}

// ── Slug generation ────────────────────────────────────────────────

const RANDOM_SUFFIX_BYTES = 4;

function slugify(name: string): string {
  // Latin/digit/dash; cyrillic transliterated to a stable readable form.
  const transliterated = name
    .toLowerCase()
    .replace(/[а-яё]/g, (c) => {
      const map: Record<string, string> = {
        а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo",
        ж: "zh", з: "z", и: "i", й: "i", к: "k", л: "l", м: "m",
        н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
        ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "",
        ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
      };
      return map[c] ?? c;
    })
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return transliterated || "workspace";
}

function randomSuffix(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(RANDOM_SUFFIX_BYTES));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Build a slug from a candidate name and confirm it doesn't collide. We
 * append a random suffix on collision rather than incrementing — collisions
 * are rare and a guess-resistant slug is friendlier for security in case
 * the slug ever appears in URLs.
 */
async function reserveSlug(candidate: string): Promise<string> {
  const base = slugify(candidate);
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug =
      attempt === 0 ? base : `${base}-${randomSuffix()}`;
    const exists = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!exists) return slug;
  }
  // After 5 attempts something is wrong — fall back to a UUID-only slug.
  return `${base}-${randomSuffix()}${randomSuffix()}`;
}

// ── Active org bootstrap ───────────────────────────────────────────

interface UserSeed {
  id: string;
  name: string | null;
  email: string;
  plan: string;
  activeOrgId: string | null;
}

/**
 * Returns the user's active organization id, creating their personal
 * workspace and migrating any pre-workspaces data into it on first call.
 *
 * Idempotent: subsequent calls just return user.activeOrgId.
 */
export async function ensureActiveOrg(userId: string): Promise<string> {
  const user = (await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      plan: true,
      activeOrgId: true,
    },
  })) as UserSeed | null;

  if (!user) throw new Error(`User ${userId} not found`);
  if (user.activeOrgId) return user.activeOrgId;

  // First-time bootstrap. Pick a friendly workspace name from the user's
  // display name or email local-part.
  const local = user.email.split("@")[0] ?? "workspace";
  const candidateName =
    user.name && user.name.trim().length > 0
      ? `Личный workspace ${user.name}`
      : `Workspace ${local}`;
  const slug = await reserveSlug(candidateName);

  const orgId = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: candidateName,
        slug,
        plan: user.plan ?? "FREE",
      },
      select: { id: true },
    });

    await tx.membership.create({
      data: { userId, orgId: org.id, role: "OWNER" },
    });

    await tx.user.update({
      where: { id: userId },
      data: { activeOrgId: org.id },
    });

    // Backfill existing per-user data into the new personal workspace so
    // the user sees no apparent change after the rollout.
    await tx.document.updateMany({
      where: { userId, orgId: null },
      data: { orgId: org.id },
    });
    await tx.generatedDocument.updateMany({
      where: { userId, orgId: null },
      data: { orgId: org.id },
    });
    await tx.chat.updateMany({
      where: { userId, orgId: null },
      data: { orgId: org.id },
    });
    await tx.counterpartyCheck.updateMany({
      where: { userId, orgId: null },
      data: { orgId: org.id },
    });
    await tx.aiUsage.updateMany({
      where: { userId, orgId: null },
      data: { orgId: org.id },
    });

    return org.id;
  });

  return orgId;
}

// ── Authorisation primitives ───────────────────────────────────────

export interface MembershipInfo {
  orgId: string;
  role: Role;
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: string;
  };
}

/**
 * Look up the requester's role in an org. Returns null if they're not a
 * member at all — distinguish from "member with low role" so callers can
 * choose 404 vs 403.
 */
export async function getMembership(
  userId: string,
  orgId: string
): Promise<MembershipInfo | null> {
  const m = await prisma.membership.findUnique({
    where: { userId_orgId: { userId, orgId } },
    include: {
      organization: { select: { id: true, name: true, slug: true, plan: true } },
    },
  });
  if (!m) return null;
  return {
    orgId: m.orgId,
    role: m.role as Role,
    organization: m.organization,
  };
}

/**
 * Throws AccessDeniedError if the user isn't a member of the org or doesn't
 * meet the required role. Use at the top of API routes that act on org-
 * scoped resources.
 */
export class OrgAccessError extends Error {
  constructor(
    message: string,
    public readonly status: 404 | 403 = 403
  ) {
    super(message);
    this.name = "OrgAccessError";
  }
}

export async function requireMembership(
  userId: string,
  orgId: string,
  minRole: Role = "MEMBER"
): Promise<MembershipInfo> {
  const m = await getMembership(userId, orgId);
  // 404 (not 403) for non-members so we don't leak which orgs exist.
  if (!m) throw new OrgAccessError("Workspace not found", 404);
  if (!roleAtLeast(m.role, minRole)) {
    throw new OrgAccessError(
      `Insufficient role: needs ${minRole}, has ${m.role}`,
      403
    );
  }
  return m;
}

// ── Listing ────────────────────────────────────────────────────────

export async function listMyOrganizations(userId: string) {
  return prisma.membership.findMany({
    where: { userId },
    include: {
      organization: {
        select: { id: true, name: true, slug: true, plan: true, createdAt: true },
      },
    },
    orderBy: { organization: { createdAt: "asc" } },
  });
}

// ── Slug helpers exposed for tests / org create flow ───────────────

export { reserveSlug, slugify };
