import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  ensureActiveOrg,
  listMyOrganizations,
  reserveSlug,
} from "@/lib/org";
import { getEffectivePlan, getEffectiveUserPlan } from "@/lib/plans";
import { reportError } from "@/lib/telemetry";
import { captureEvent } from "@/lib/analytics/server";
import { logAudit, attribution } from "@/lib/audit";

// GET /api/organizations
//   List the workspaces the current user is a member of, with their role
//   and which one is currently active. Used by the OrgSwitcher.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Make sure the user has at least one org before we list (covers the
    // first-ever-call case for an account that signed up pre-workspaces).
    const activeOrgId =
      session.user.activeOrgId ?? (await ensureActiveOrg(session.user.id));

    const [memberships, user] = await Promise.all([
      listMyOrganizations(session.user.id),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { plan: true, trialEndsAt: true },
      }),
    ]);

    // Plan / trial are now user-scoped. Every workspace the user owns
    // inherits their personal plan; workspaces they're a MEMBER of
    // inherit the OWNER's plan (resolved server-side per workspace).
    // OrgSwitcher only needs the user-level effective plan when the
    // viewer is OWNER — for non-owned workspaces the chip shows the
    // workspace's stored plan (best-effort).
    const userEffective = getEffectiveUserPlan({
      plan: user?.plan,
      trialEndsAt: user?.trialEndsAt ?? null,
    });

    return NextResponse.json({
      activeOrgId,
      organizations: memberships.map((m) => {
        // Owned workspace? Show the user's plan/trial (authoritative).
        // Otherwise fall back to the org's stored fields.
        const isOwner = m.role === "OWNER";
        const effective = isOwner
          ? userEffective
          : getEffectivePlan({
              plan: m.organization.plan,
              trialEndsAt: m.organization.trialEndsAt,
            });
        return {
          id: m.organization.id,
          name: m.organization.name,
          slug: m.organization.slug,
          plan: effective.plan,
          baselinePlan: effective.baselinePlan,
          isTrial: effective.isTrial,
          trialEndsAt: effective.trialEndsAt
            ? effective.trialEndsAt.toISOString()
            : null,
          trialDaysLeft: effective.trialDaysLeft,
          role: m.role,
          isActive: m.organization.id === activeOrgId,
          createdAt: m.organization.createdAt,
        };
      }),
    });
  } catch (error) {
    await reportError(error, { op: "organizations.list" });
    return NextResponse.json(
      { error: "Не удалось загрузить список workspace" },
      { status: 500 }
    );
  }
}

// Hard cap on total OWNED workspaces per user — anti-spam brake. Even
// paying users don't have a legitimate reason to spawn dozens of
// workspaces from a single account; if they do, support can lift the
// cap manually after a conversation.
const MAX_OWNED_WORKSPACES = 10;

// POST /api/organizations  { name }
//   Create a new workspace and make the caller its OWNER. The new
//   workspace does NOT become active automatically — that's a separate
//   /switch call so the UI can confirm with the user first.
//
// Anti-abuse: a user can OWN at most one workspace whose stored plan
// is FREE — including workspaces currently on a trial. Without this
// guard, a free-tier user can spawn N workspaces and effectively
// multiply their monthly quota by N (since AiUsage is scoped per-org).
// Trial-time workspaces deliberately count: a user "trialing PRO" hasn't
// paid yet, and would otherwise be able to create a second non-trialing
// FREE workspace and farm extra quota that way. Only a workspace whose
// stored plan is actually paid (PRO/BUSINESS) unlocks creating more.
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: unknown;
    };
    const name =
      typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2 || name.length > 80) {
      return NextResponse.json(
        { error: "Название workspace должно быть от 2 до 80 символов" },
        { status: 400 }
      );
    }

    // Plan / trial are user-scoped now. The anti-abuse check reads
    // User.plan directly: a FREE user (including trial) gets exactly
    // one owned workspace; a paying user can create up to MAX_OWNED.
    // We still load the owned workspaces for the count and so we can
    // surface a useful "upgrade to extend" error pointing at an
    // existing workspace name.
    const [ownedMemberships, user] = await Promise.all([
      prisma.membership.findMany({
        where: { userId: session.user.id, role: "OWNER" },
        include: {
          organization: {
            select: { id: true, name: true, plan: true, trialEndsAt: true },
          },
        },
      }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { plan: true, trialEndsAt: true },
      }),
    ]);

    if (ownedMemberships.length >= MAX_OWNED_WORKSPACES) {
      return NextResponse.json(
        {
          error: `Достигнут лимит в ${MAX_OWNED_WORKSPACES} workspace на аккаунт. Свяжитесь с поддержкой, если нужно больше.`,
        },
        { status: 403 }
      );
    }

    // Free / trial users are capped at one owned workspace. We use the
    // stored User.plan (not effective) to decide: a trial user is on
    // "FREE" plan with a trial bridge — letting them create a second
    // FREE workspace would silently multiply their quota.
    if (user?.plan === "FREE" && ownedMemberships.length >= 1) {
      const userEffective = getEffectiveUserPlan({
        plan: user.plan,
        trialEndsAt: user.trialEndsAt ?? null,
      });
      const firstOwned = ownedMemberships[0];
      const errorMessage = userEffective.isTrial
        ? `Создавать дополнительные workspace можно только на платном тарифе. Сейчас вы на пробном периоде «Про» — оформите подписку, чтобы расширить аккаунт.`
        : `На бесплатном тарифе можно иметь только один workspace «${firstOwned.organization.name}». Чтобы создать ещё один — оформите подписку «Про» или «Бизнес».`;

      return NextResponse.json(
        {
          error: errorMessage,
          code: "FREE_WORKSPACE_LIMIT",
          existingWorkspaceId: firstOwned.organization.id,
          existingWorkspaceName: firstOwned.organization.name,
        },
        { status: 403 }
      );
    }

    const slug = await reserveSlug(name);

    const org = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: { name, slug, plan: "FREE" },
      });
      await tx.membership.create({
        data: { userId: session.user.id, orgId: created.id, role: "OWNER" },
      });
      return created;
    });

    void captureEvent({
      userId: session.user.id,
      orgId: org.id,
      event: "workspace_created",
      properties: { plan: org.plan },
    });
    void logAudit({
      orgId: org.id,
      userId: session.user.id,
      action: "workspace.created",
      target: org.id,
      targetType: "workspace",
      payload: { name: org.name, plan: org.plan },
      ...attribution(request),
    });

    // No trial for additional orgs — the trial is granted exactly once,
    // at the user's first auto-bootstrapped personal workspace, in
    // ensureActiveOrg().
    return NextResponse.json({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      baselinePlan: org.plan,
      isTrial: false,
      trialEndsAt: null,
      trialDaysLeft: null,
      role: "OWNER" as const,
      createdAt: org.createdAt,
    });
  } catch (error) {
    await reportError(error, { op: "organizations.create" });
    return NextResponse.json(
      { error: "Не удалось создать workspace" },
      { status: 500 }
    );
  }
}
