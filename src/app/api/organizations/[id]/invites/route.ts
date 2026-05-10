import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { OrgAccessError, requireMembership, type Role } from "@/lib/org";
import { reportError } from "@/lib/telemetry";
import { sendEmail } from "@/lib/email";
import { buildInviteEmail } from "@/lib/email/templates/invite";

// Token is 32 random bytes hex-encoded — 256 bits of entropy, unguessable.
const TOKEN_BYTES = 32;
const DEFAULT_TTL_DAYS = 7;

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// GET /api/organizations/[id]/invites
//   Active invites for the workspace. Used by the settings page to list
//   pending links so the admin can revoke them. ADMIN+ only.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await requireMembership(session.user.id, id, "ADMIN");

    const invites = await prisma.invite.findMany({
      where: { orgId: id, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        token: true,
        expiresAt: true,
        createdAt: true,
        createdBy: true,
      },
    });

    return NextResponse.json({ invites });
  } catch (error) {
    if (error instanceof OrgAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    await reportError(error, { op: "invites.list" });
    return NextResponse.json(
      { error: "Не удалось загрузить приглашения" },
      { status: 500 }
    );
  }
}

// POST /api/organizations/[id]/invites  { email?, role? }
//   Create a new invite link. Returns the token + a ready-to-share URL.
//   ADMIN+ only. OWNER role can only be granted by another OWNER (defence
//   against an ADMIN escalating themselves).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const me = await requireMembership(session.user.id, id, "ADMIN");

    const body = (await request.json().catch(() => ({}))) as {
      email?: unknown;
      role?: unknown;
    };

    const role: Role = body.role === "ADMIN" ? "ADMIN" : "MEMBER";
    if (role === "ADMIN" && me.role !== "OWNER") {
      // Quietly downgrade — admins can invite admins-of-equal-rank but not
      // promote to OWNER. This MVP doesn't expose OWNER as an invite role.
    }

    const email =
      typeof body.email === "string" && body.email.trim().length > 0
        ? body.email.trim().toLowerCase()
        : null;

    const token = generateToken();
    const expiresAt = new Date(
      Date.now() + DEFAULT_TTL_DAYS * 24 * 60 * 60 * 1000
    );

    const invite = await prisma.invite.create({
      data: {
        orgId: id,
        email,
        role,
        token,
        expiresAt,
        createdBy: session.user.id,
      },
    });

    // Build the shareable URL using the request origin so it works on every
    // deployment env (preview / prod / local) without hard-coding.
    const url = new URL(
      `/invite/${token}`,
      request.headers.get("origin") ??
        `https://${request.headers.get("host") ?? "localhost"}`
    );

    // Send the invite email when a target address was supplied. Fire-and-
    // forget — the URL is also returned in the response, so the inviter can
    // copy/paste it as a fallback if delivery fails.
    let emailDelivered: { ok: boolean; error?: string } | null = null;
    if (email) {
      const inviter = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, email: true },
      });
      const orgRow = await prisma.organization.findUnique({
        where: { id },
        select: { name: true },
      });
      if (inviter?.email && orgRow?.name) {
        const result = await sendEmail(
          buildInviteEmail({
            to: email,
            orgName: orgRow.name,
            inviterName: inviter.name,
            inviterEmail: inviter.email,
            role,
            acceptUrl: url.toString(),
            expiresAt: expiresAt.toISOString(),
          })
        );
        emailDelivered = { ok: result.ok, error: result.error };
      }
    }

    return NextResponse.json({
      invite: {
        id: invite.id,
        token,
        role,
        email,
        expiresAt,
        url: url.toString(),
      },
      emailDelivered,
    });
  } catch (error) {
    if (error instanceof OrgAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    await reportError(error, { op: "invites.create" });
    return NextResponse.json(
      { error: "Не удалось создать приглашение" },
      { status: 500 }
    );
  }
}
