import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id } = await params;

    // Look up by both id and userId so a foreign id returns the same 404 as
    // a non-existent one — no enumeration via response shape.
    const document = await prisma.document.findFirst({
      where: { id, userId: session.user.id },
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
    console.error("Document file fetch error:", error);
    return NextResponse.json(
      { error: "Ошибка при получении файла" },
      { status: 500 }
    );
  }
}
