import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { checkQuotaSafe } from "@/lib/quota";
import { ensureActiveOrg, getMembership } from "@/lib/org";
import { getStorage, isStorageAvailable } from "@/lib/storage";
import { reportError } from "@/lib/telemetry";
import { prepareDocument, PrepareError } from "@/lib/analyze/prepare";
import { kickOffBackgroundAnalyze } from "@/lib/analyze/kick-off";
import { pickStageFromProgress } from "@/lib/analyze/job";
import { captureEvent } from "@/lib/analytics/server";

// Synchronous portion: parse + OCR + quota check + DB row creation.
// Budget ~15s. Returns analysisId so the client can poll for progress.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
    const rl = await rateLimit(ip, "analyze.start");
    if (!rl.ok) {
      return NextResponse.json(
        {
          error: "Слишком много запросов. Подождите немного.",
          code: "RATE_LIMITED",
          resetAt: rl.resetAt,
        },
        { status: 429 }
      );
    }

    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { error: "Авторизуйтесь для запуска анализа." },
        { status: 401 }
      );
    }
    const orgId =
      session?.user?.activeOrgId ?? (await ensureActiveOrg(userId));

    // VIEWER role can't spend quota.
    const m = await getMembership(userId, orgId as string);
    if (m?.role === "VIEWER") {
      return NextResponse.json(
        { error: "Роль «Наблюдатель» не позволяет запускать анализ договоров." },
        { status: 403 }
      );
    }

    // Quota check — only check, don't consume. Worker consumes on COMPLETED.
    const quota = await checkQuotaSafe(orgId as string, "analyze");
    if (quota && !quota.allowed) {
      return NextResponse.json(
        {
          error: `Лимит тарифа ${quota.plan} исчерпан: ${quota.used} из ${quota.limit} анализов в этом месяце.`,
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

    // OCR allowed flag — for prepareDocument
    const ocrQuota = await checkQuotaSafe(orgId as string, "ocr");
    const ocrAllowed = ocrQuota ? ocrQuota.allowed : false;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Файл не предоставлен" }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Файл слишком большой. Максимальный размер — 10 МБ" },
        { status: 400 }
      );
    }

    // Parse + OCR (synchronous part, budget ~15s).
    let prepared;
    try {
      prepared = await prepareDocument(file, ocrAllowed, userId, orgId as string);
    } catch (err) {
      if (err instanceof PrepareError) {
        const status =
          err.code === "DOCUMENT_TOO_LARGE"
            ? 413
            : err.code === "OCR_NOT_AVAILABLE"
              ? 402
              : err.code === "PARSE_FAILED" || err.code === "EMPTY_DOCUMENT"
                ? 400
                : 422;
        return NextResponse.json(
          { error: err.message, code: err.code, ...(err.extra ?? {}) },
          { status }
        );
      }
      throw err;
    }

    // Upload original to Blob (fire-and-forget — analysis runs without it).
    let blobInfo: { url: string; key: string } | null = null;
    if (isStorageAvailable()) {
      try {
        const storage = getStorage();
        const uploaded = await storage.upload({
          fileName: file.name,
          mimeType: prepared.mimeType,
          data: prepared.fileBytes,
          folder: `documents/${userId}`,
        });
        blobInfo = { url: uploaded.url, key: uploaded.key };
      } catch (storageError) {
        console.error("Failed to store original document:", storageError);
      }
    }

    // Create Document + PENDING Analysis row atomically.
    const document = await prisma.document.create({
      data: {
        userId,
        orgId: orgId as string,
        fileName: file.name,
        fileSize: file.size,
        rawText: prepared.contractText,
        mimeType: prepared.mimeType,
        blobUrl: blobInfo?.url ?? null,
        blobKey: blobInfo?.key ?? null,
        analysis: {
          create: {
            status: "PENDING",
            progress: 0,
            stage: pickStageFromProgress(0),
            // score/summary/risks default to 0/""/"[]" via schema defaults
          },
        },
      },
      include: { analysis: true },
    });

    if (!document.analysis) {
      // Shouldn't happen — schema guarantees the nested create.
      return NextResponse.json(
        { error: "Не удалось создать запись анализа" },
        { status: 500 }
      );
    }

    void captureEvent({
      userId,
      orgId: orgId as string,
      event: "analysis_started",
      properties: {
        textLength: prepared.contractText.length,
        usedOcr: prepared.usedOcr,
      },
    });

    // Kick off background worker (fire-and-forget — function continues
    // returning the response regardless of kick-off outcome).
    void kickOffBackgroundAnalyze(document.analysis.id);

    return NextResponse.json({
      analysisId: document.analysis.id,
      documentId: document.id,
    });
  } catch (error) {
    await reportError(error, { op: "analyze.start" });
    const detail =
      error instanceof Error
        ? `${error.name}: ${error.message}`.slice(0, 500)
        : String(error).slice(0, 500);
    return NextResponse.json(
      { error: "Ошибка при создании анализа. Попробуйте позже.", detail },
      { status: 500 }
    );
  }
}
