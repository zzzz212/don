import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureActiveOrg } from "@/lib/org";
import { logAudit, attribution } from "@/lib/audit";
import { BRAND } from "@/lib/legal-info";
import { reportError } from "@/lib/telemetry";

// Read-only public links to a contract analysis. The token is the
// credential — 192 bits of entropy, unguessable.

const SHARE_TTL_DAYS = 90;

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function shareUrl(token: string): string {
  return `${BRAND.publicUrl}/r/${token}`;
}

/** Resolve the document if it belongs to the caller's workspace. */
async function ownedDocument(userId: string, documentId: string) {
  const orgId = await ensureActiveOrg(userId);
  return prisma.document.findFirst({
    where: { id: documentId, orgId },
    select: { id: true },
  });
}

// GET — the document's currently active public link, if any.
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
    if (!(await ownedDocument(session.user.id, id))) {
      return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
    }

    const share = await prisma.publicShare.findFirst({
      where: {
        documentId: id,
        revoked: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      share: share
        ? {
            token: share.token,
            url: shareUrl(share.token),
            viewCount: share.viewCount,
            expiresAt: share.expiresAt?.toISOString() ?? null,
          }
        : null,
    });
  } catch (error) {
    await reportError(error, { op: "public-share.get" });
    return NextResponse.json(
      { error: "Не удалось загрузить ссылку" },
      { status: 500 }
    );
  }
}

// POST — create a public link (or return the existing active one).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const me = session.user.id;
    const { id } = await params;
    if (!(await ownedDocument(me, id))) {
      return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
    }

    const existing = await prisma.publicShare.findFirst({
      where: {
        documentId: id,
        revoked: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return NextResponse.json({
        share: {
          token: existing.token,
          url: shareUrl(existing.token),
          viewCount: existing.viewCount,
          expiresAt: existing.expiresAt?.toISOString() ?? null,
        },
      });
    }

    const expiresAt = new Date(
      Date.now() + SHARE_TTL_DAYS * 24 * 60 * 60 * 1000
    );
    const share = await prisma.publicShare.create({
      data: { documentId: id, createdBy: me, token: newToken(), expiresAt },
    });

    void logAudit({
      orgId: null,
      userId: me,
      action: "public_share.created",
      target: id,
      targetType: "document",
      ...attribution(request),
    });

    return NextResponse.json({
      share: {
        token: share.token,
        url: shareUrl(share.token),
        viewCount: 0,
        expiresAt: share.expiresAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    await reportError(error, { op: "public-share.create" });
    return NextResponse.json(
      { error: "Не удалось создать ссылку" },
      { status: 500 }
    );
  }
}

// DELETE — revoke every active link for the document.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const me = session.user.id;
    const { id } = await params;
    if (!(await ownedDocument(me, id))) {
      return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
    }

    await prisma.publicShare.updateMany({
      where: { documentId: id, revoked: false },
      data: { revoked: true },
    });

    void logAudit({
      orgId: null,
      userId: me,
      action: "public_share.revoked",
      target: id,
      targetType: "document",
      ...attribution(request),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    await reportError(error, { op: "public-share.revoke" });
    return NextResponse.json(
      { error: "Не удалось отозвать ссылку" },
      { status: 500 }
    );
  }
}
