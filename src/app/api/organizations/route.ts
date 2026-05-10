import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  ensureActiveOrg,
  listMyOrganizations,
  reserveSlug,
} from "@/lib/org";
import { getEffectivePlan } from "@/lib/plans";
import { reportError } from "@/lib/telemetry";
import { captureEvent } from "@/lib/analytics/server";

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

    const memberships = await listMyOrganizations(session.user.id);

    return NextResponse.json({
      activeOrgId,
      organizations: memberships.map((m) => {
        const effective = getEffectivePlan({
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

    // Pull every workspace the user is OWNER of in one go. We need plan
    // and trialEndsAt to compute the effective plan and decide whether
    // a free workspace already exists.
    const ownedMemberships = await prisma.membership.findMany({
      where: { userId: session.user.id, role: "OWNER" },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            plan: true,
            trialEndsAt: true,
          },
        },
      },
    });

    if (ownedMemberships.length >= MAX_OWNED_WORKSPACES) {
      return NextResponse.json(
        {
          error: `Достигнут лимит в ${MAX_OWNED_WORKSPACES} workspace на аккаунт. Свяжитесь с поддержкой, если нужно больше.`,
        },
        { status: 403 }
      );
    }

    // Use the *stored* plan (not effective). A trial-active workspace
    // has effective plan === "PRO" but stored plan === "FREE", and we
    // want to count it toward the cap so the user can't farm a second
    // FREE workspace alongside a trial.
    const existingNonPaid = ownedMemberships.find(
      (m) => m.organization.plan === "FREE"
    );

    if (existingNonPaid) {
      // Tailor the message: trial-active vs plain free, since the user
      // experience and recovery action differ ("оплатите подписку" vs
      // "оплатите подписку, не дожидаясь конца триала").
      const eff = getEffectivePlan({
        plan: existingNonPaid.organization.plan,
        trialEndsAt: existingNonPaid.organization.trialEndsAt,
      });
      const errorMessage = eff.isTrial
        ? `Создавать дополнительные workspace можно только на платном тарифе. Сейчас «${existingNonPaid.organization.name}» использует пробный период «Про» — оформите подписку, чтобы расширить аккаунт.`
        : `На бесплатном тарифе можно иметь только один workspace. Чтобы создать ещё один — оплатите тариф для существующего workspace «${existingNonPaid.organization.name}».`;

      return NextResponse.json(
        {
          error: errorMessage,
          code: "FREE_WORKSPACE_LIMIT",
          existingWorkspaceId: existingNonPaid.organization.id,
          existingWorkspaceName: existingNonPaid.organization.name,
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
