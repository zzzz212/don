import { NextRequest, NextResponse } from "next/server";
import { parseDocument } from "@/lib/parsers";
import { analyzeContract } from "@/lib/ai/analyze";
import { isOversizedDocument, HARD_DOC_LIMIT } from "@/lib/ai/chunking";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { checkQuotaSafe } from "@/lib/quota";
import { getStorage, isStorageAvailable } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
    const rl = await rateLimit(ip, "analyze");
    if (!rl.ok) {
      return NextResponse.json(
        {
          error: "Слишком много запросов. Подождите немного.",
          code: "RATE_LIMITED",
          resetAt: rl.resetAt,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(rl.limit),
            "X-RateLimit-Remaining": String(rl.remaining),
            "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
          },
        }
      );
    }

    const session = await auth();
    const userId = session?.user?.id;

    // Plan-based quota check (anonymous users skip; rate limit already applied)
    if (userId) {
      const quota = await checkQuotaSafe(userId, "analyze");
      if (quota && !quota.allowed) {
        return NextResponse.json(
          {
            error: `Лимит тарифа ${quota.plan} исчерпан: ${quota.used} из ${quota.limit} анализов в этом месяце. Перейдите на тариф «Про» для безлимита.`,
            code: "QUOTA_EXCEEDED",
            quota: {
              feature: quota.feature,
              used: quota.used,
              limit: quota.limit,
              plan: quota.plan,
              resetsAt: quota.resetsAt.toISOString(),
            },
          },
          { status: 402 }
        );
      }
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Файл не предоставлен" },
        { status: 400 }
      );
    }

    // Validate file size (10 MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Файл слишком большой. Максимальный размер — 10 МБ" },
        { status: 400 }
      );
    }

    // Capture original bytes once — parseDocument consumes the stream and we
    // also want to push the original to object storage if configured.
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";

    // Parse the document
    let contractText: string;
    try {
      const parsed = await parseDocument(
        new File([fileBytes], file.name, { type: mimeType })
      );
      contractText = parsed.text;
    } catch {
      return NextResponse.json(
        { error: "Не удалось прочитать файл. Убедитесь, что формат поддерживается (PDF, DOCX, TXT)." },
        { status: 400 }
      );
    }

    if (!contractText.trim()) {
      return NextResponse.json(
        { error: "Документ пуст или не содержит текста. Возможно, PDF состоит из сканированных изображений." },
        { status: 400 }
      );
    }

    if (isOversizedDocument(contractText)) {
      return NextResponse.json(
        {
          error: `Документ слишком большой для автоматического анализа (${contractText.length.toLocaleString("ru-RU")} символов, лимит ${HARD_DOC_LIMIT.toLocaleString("ru-RU")}). Разбейте его на части и проанализируйте по разделам.`,
          code: "DOCUMENT_TOO_LARGE",
          textLength: contractText.length,
          limit: HARD_DOC_LIMIT,
        },
        { status: 413 }
      );
    }

    const analysis = await analyzeContract(contractText, userId ?? null);

    // Upload original file to object storage in parallel with DB save below.
    // Storage failure must not fail the request — the user still gets their
    // analysis. We just won't have a "Скачать оригинал" link for this doc.
    let blobInfo: { url: string; key: string } | null = null;
    if (userId && isStorageAvailable()) {
      try {
        const storage = getStorage();
        const uploaded = await storage.upload({
          fileName: file.name,
          mimeType,
          data: fileBytes,
          folder: `documents/${userId}`,
        });
        blobInfo = { url: uploaded.url, key: uploaded.key };
      } catch (storageError) {
        console.error("Failed to store original document:", storageError);
      }
    }

    // Save to DB if user is authenticated
    let documentId: string | null = null;
    if (userId) {
      try {
        // Verify user exists in DB (JWT may reference a deleted user)
        const userExists = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true },
        });

        if (userExists) {
          const metadata = JSON.stringify({
            contractType: analysis.contractType,
            parties: analysis.parties,
            notarization: analysis.notarization,
            registration: analysis.registration,
            missingClauses: analysis.missingClauses,
            preSigningChecklist: analysis.preSigningChecklist,
            isDemo: analysis.isDemo ?? false,
          });

          const document = await prisma.document.create({
            data: {
              userId,
              fileName: file.name,
              fileSize: file.size,
              rawText: contractText,
              mimeType,
              blobUrl: blobInfo?.url ?? null,
              blobKey: blobInfo?.key ?? null,
              analysis: {
                create: {
                  score: analysis.score,
                  summary: analysis.summary,
                  risks: JSON.stringify(analysis.risks),
                  metadata,
                },
              },
            },
            include: { analysis: true },
          });
          documentId = document.id;
        }
      } catch (dbError) {
        // DB save failed — still return the analysis result
        console.error("Failed to save document:", dbError);
      }
    }

    return NextResponse.json({
      ...analysis,
      documentId,
      fileName: file.name,
      textLength: contractText.length,
      hasOriginal: documentId !== null && blobInfo !== null,
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Ошибка при анализе документа. Попробуйте позже." },
      { status: 500 }
    );
  }
}
