import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireAdmin, AdminAccessError } from "@/lib/admin";
import { getStorage } from "@/lib/storage";
import { logAudit, attribution } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import {
  buildInnVerifiedEmail,
  buildInnRejectedEmail,
} from "@/lib/email/templates/inn-verification";
import { BRAND } from "@/lib/legal-info";
import { reportError } from "@/lib/telemetry";

const ActionSchema = z.object({
  action: z.enum(["verify", "reject"]),
  note: z.string().trim().max(500).optional(),
});

// POST /api/admin/inn-claims/[userId] — resolve one ИНН verification.
//   action "verify" — the extract confirmed the claim → innStatus
//                      becomes "verified".
//   action "reject" — note is required; the extract stays rejected, the
//                      ИНН drops back to "claimed" so the user can
//                      re-upload, and the stored document is deleted.
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    requireAdmin(session?.user?.id);
    const adminId = session!.user!.id;

    const { userId } = await props.params;
    const parsed = ActionSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }
    const { action, note } = parsed.data;

    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: {
        inn: true,
        innStatus: true,
        innCompanyName: true,
        innDocKey: true,
        user: { select: { email: true } },
      },
    });
    if (!profile?.inn || profile.innStatus !== "claimed") {
      return NextResponse.json(
        { error: "Заявка на подтверждение ИНН не найдена" },
        { status: 404 }
      );
    }

    const profileUrl = `${BRAND.publicUrl}/network`;

    if (action === "verify") {
      await prisma.userProfile.update({
        where: { userId },
        data: {
          innStatus: "verified",
          innVerifiedAt: new Date(),
          innRejectionNote: null,
        },
      });
      void logAudit({
        orgId: null,
        userId: adminId,
        action: "inn.verified",
        target: profile.inn,
        targetType: "user",
        payload: { subjectUserId: userId },
        ...attribution(request),
      });
      if (profile.user.email) {
        await sendEmail(
          buildInnVerifiedEmail({
            to: profile.user.email,
            companyName: profile.innCompanyName ?? `ИНН ${profile.inn}`,
            profileUrl,
          })
        );
      }
      return NextResponse.json({ ok: true, status: "verified" });
    }

    // reject — note is mandatory so the user knows what to fix.
    const reason = (note ?? "").trim();
    if (reason.length === 0) {
      return NextResponse.json(
        { error: "Укажите причину отклонения" },
        { status: 400 }
      );
    }
    if (profile.innDocKey) {
      await getStorage()
        .delete(profile.innDocKey)
        .catch(() => undefined);
    }
    await prisma.userProfile.update({
      where: { userId },
      data: {
        innDocUrl: null,
        innDocKey: null,
        innRejectionNote: reason,
      },
    });
    void logAudit({
      orgId: null,
      userId: adminId,
      action: "inn.rejected",
      target: profile.inn,
      targetType: "user",
      payload: { subjectUserId: userId },
      ...attribution(request),
    });
    if (profile.user.email) {
      await sendEmail(
        buildInnRejectedEmail({
          to: profile.user.email,
          reason,
          profileUrl,
        })
      );
    }
    return NextResponse.json({ ok: true, status: "rejected" });
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    await reportError(error, { op: "admin.inn.resolve" });
    return NextResponse.json(
      { error: "Не удалось обработать заявку" },
      { status: 500 }
    );
  }
}
