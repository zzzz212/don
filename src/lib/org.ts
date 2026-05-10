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
import { TRIAL_DAYS } from "@/lib/legal-info";

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
 * Idempotent: subsequent calls just return user.activeOrgId — but with a
 * couple of safety checks so a stale activeOrgId pointing to a deleted
 * org (which produces ugly FK violations on every Document.create) gets
 * silently healed.
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

  // 1. Happy path — activeOrgId is set AND points to a real org we still
  //    belong to. Verify both because activeOrgId is just a String field
  //    (not a FK), so it can drift if an org was deleted out from under us.
  if (user.activeOrgId) {
    const stillValid = await prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId: user.activeOrgId } },
      select: { orgId: true },
    });
    if (stillValid) return user.activeOrgId;

    // Stale activeOrgId — clear it so we don't keep returning it on
    // future calls. Fall through to the recovery branches below.
    console.warn(
      `[ensureActiveOrg] user ${userId} had stale activeOrgId ${user.activeOrgId}, healing…`
    );
    await prisma.user.update({
      where: { id: userId },
      data: { activeOrgId: null },
    });
  }

  // 2. Recovery — maybe they belong to other orgs (e.g. accepted an invite
  //    while their personal workspace was being deleted). Pick the oldest
  //    membership as the new active and return.
  const fallback = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { orgId: true },
  });
  if (fallback) {
    await prisma.user.update({
      where: { id: userId },
      data: { activeOrgId: fallback.orgId },
    });
    return fallback.orgId;
  }

  // 3. First-time bootstrap (no active, no other memberships). Pick a
  //    friendly workspace name from the user's display name or email
  //    local-part.
  const local = user.email.split("@")[0] ?? "workspace";
  const candidateName =
    user.name && user.name.trim().length > 0
      ? `Личный workspace ${user.name}`
      : `Workspace ${local}`;
  const slug = await reserveSlug(candidateName);

  // Grant the trial only on the user's *first* org. Subsequent orgs they
  // explicitly create later must not re-extend the trial — that's the
  // anti-abuse guard. We're inside the bootstrap branch (no other
  // memberships) so this is the first-org case by construction. The
  // trial is now user-scoped (User.trialEndsAt is authoritative); the
  // Organization.trialEndsAt copy is kept in sync only so legacy
  // queries don't break.
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const orgId = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: candidateName,
        slug,
        plan: user.plan ?? "FREE",
        trialEndsAt,
      },
      select: { id: true },
    });

    await tx.membership.create({
      data: { userId, orgId: org.id, role: "OWNER" },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        activeOrgId: org.id,
        // Mark the trial as claimed (lifetime flag) and grant the trial
        // window on the user record itself — single source of truth for
        // quota lookups. Mirrors Organization.trialEndsAt above for
        // legacy compatibility.
        trialActivatedAt: now,
        trialEndsAt,
      },
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
    trialEndsAt: Date | null;
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
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          trialEndsAt: true,
        },
      },
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
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          trialEndsAt: true,
          createdAt: true,
        },
      },
    },
    orderBy: { organization: { createdAt: "asc" } },
  });
}

// ── Slug helpers exposed for tests / org create flow ───────────────

export { reserveSlug, slugify };
