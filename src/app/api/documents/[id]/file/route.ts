import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { reportError } from "@/lib/telemetry";
import { ensureActiveOrg } from "@/lib/org";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const orgId =
      session.user.activeOrgId ?? (await ensureActiveOrg(session.user.id));
    const { id } = await params;

    // Workspace-scoped lookup. Foreign-org docs return the same 404 shape
    // as a missing id, so the response can't be used to enumerate ids.
    const document = await prisma.document.findFirst({
      where: { id, orgId },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        blobKey: true,
        blobUrl: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Документ не найден" },
        { status: 404 }
      );
    }

    if (!document.blobKey || !document.blobUrl) {
      return NextResponse.json(
        {
          error:
            "Оригинал документа не сохранён. Эта функция доступна только для документов, загруженных после включения хранилища.",
          code: "ORIGINAL_NOT_STORED",
        },
        { status: 404 }
      );
    }

    // Refresh URL via the provider in case the stored URL has rotated. For
    // Vercel Blob with public access it will return the same URL — but for
    // future signed-URL providers this matters.
    let downloadUrl = document.blobUrl;
    try {
      const storage = getStorage();
      downloadUrl = await storage.getDownloadUrl(document.blobKey, {
        ttlSeconds: 5 * 60,
        downloadFileName: document.fileName,
      });
    } catch (e) {
      // Fall back to the stored URL — it's still valid for Vercel Blob.
      console.error("[documents/file] getDownloadUrl failed:", e);
    }

    // 302 redirect to the storage URL. The browser receives the file directly
    // from the CDN, our function isn't a proxy.
    return NextResponse.redirect(downloadUrl, {
      status: 302,
      headers: {
        "Cache-Control": "no-store, private",
      },
    });
  } catch (error) {
    await reportError(error, { op: "documents.file" });
    return NextResponse.json(
      { error: "Ошибка при получении файла" },
      { status: 500 }
    );
  }
}
