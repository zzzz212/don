import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  ensureActiveOrg,
  listMyOrganizations,
  reserveSlug,
} from "@/lib/org";
import { reportError } from "@/lib/telemetry";

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
      organizations: memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        plan: m.organization.plan,
        role: m.role,
        isActive: m.organization.id === activeOrgId,
        createdAt: m.organization.createdAt,
      })),
    });
  } catch (error) {
    await reportError(error, { op: "organizations.list" });
    return NextResponse.json(
      { error: "Не удалось загрузить список workspace" },
      { status: 500 }
    );
  }
}

// POST /api/organizations  { name }
//   Create a new workspace and make the caller its OWNER. The new
//   workspace does NOT become active automatically — that's a separate
//   /switch call so the UI can confirm with the user first.
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

    return NextResponse.json({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
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
