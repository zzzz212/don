import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureProfile, networkRateLimitOk } from "@/lib/network";
import { getStorage, isStorageAvailable } from "@/lib/storage";
import { logAudit, attribution } from "@/lib/audit";
import { reportError } from "@/lib/telemetry";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
]);

// POST /api/network/profile/inn/document — upload a ЕГРЮЛ/ЕГРИП extract
// (or similar) so an admin can verify the linked ИНН. The ИНН must
// already be claimed; the upload moves the claim into the review queue.
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const me = session.user.id;
    if (!(await networkRateLimitOk(me))) {
      return NextResponse.json(
        { error: "Слишком много действий подряд. Подождите минуту." },
        { status: 429 }
      );
    }

    if (!isStorageAvailable()) {
      return NextResponse.json(
        { error: "Загрузка документов временно недоступна" },
        { status: 503 }
      );
    }

    const profile = await prisma.userProfile.findUnique({
      where: { userId: me },
      select: { inn: true, innStatus: true, innDocKey: true },
    });
    if (!profile?.inn || profile.innStatus === "none") {
      return NextResponse.json(
        { error: "Сначала привяжите ИНН" },
        { status: 409 }
      );
    }
    if (profile.innStatus === "verified") {
      return NextResponse.json(
        { error: "ИНН уже подтверждён" },
        { status: 409 }
      );
    }

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Файл не приложен" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "Файл пустой" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Файл больше 10 МБ" },
        { status: 400 }
      );
    }
    const mimeType = file.type || "application/octet-stream";
    if (!ALLOWED.has(mimeType)) {
      return NextResponse.json(
        { error: "Допустимы PDF, JPG, PNG" },
        { status: 400 }
      );
    }

    const data = new Uint8Array(await file.arrayBuffer());
    const uploaded = await getStorage().upload({
      fileName: file.name || "inn-extract",
      mimeType,
      data,
      folder: `inn-docs/${me}`,
    });

    // Drop the previous extract if the user is re-uploading after a
    // rejection — keep only the document currently under review.
    if (profile.innDocKey && profile.innDocKey !== uploaded.key) {
      await getStorage()
        .delete(profile.innDocKey)
        .catch(() => undefined);
    }

    const updated = await prisma.userProfile.update({
      where: { userId: me },
      data: {
        innDocUrl: uploaded.url,
        innDocKey: uploaded.key,
        innRejectionNote: null,
      },
    });

    void logAudit({
      orgId: null,
      userId: me,
      action: "inn.doc_uploaded",
      target: profile.inn,
      targetType: "user",
      ...attribution(request),
    });

    await ensureProfile(me);
    return NextResponse.json({ profile: updated });
  } catch (error) {
    await reportError(error, { op: "network.profile.inn.document" });
    return NextResponse.json(
      { error: "Не удалось загрузить документ" },
      { status: 500 }
    );
  }
}
