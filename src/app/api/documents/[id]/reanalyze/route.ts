import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { checkQuotaSafe } from "@/lib/quota";
import { analyzeContract } from "@/lib/ai/analyze";
import { isOversizedDocument, HARD_DOC_LIMIT } from "@/lib/ai/chunking";
import { reportError } from "@/lib/telemetry";
import { embedDocumentChunks, hasEmbeddings } from "@/lib/document-search";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id } = await params;

    // Look up scoped to userId so foreign / non-existent documents share
    // the same 404 — no enumeration via response shape.
    const document = await prisma.document.findFirst({
      where: { id, userId },
      include: { analysis: true },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Документ не найден" },
        { status: 404 }
      );
    }

    if (!document.rawText || document.rawText.trim().length === 0) {
      return NextResponse.json(
        {
          error:
            "Текст документа не сохранён в БД — повторный анализ невозможен. Загрузите файл заново.",
          code: "NO_RAW_TEXT",
        },
        { status: 422 }
      );
    }

    // Quota check — re-analysis costs an analyze credit just like the first
    // run. Skipping this would let FREE users bypass the monthly cap by
    // pressing "Перепроанализировать" repeatedly.
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

    if (isOversizedDocument(document.rawText)) {
      return NextResponse.json(
        {
          error: `Документ слишком большой для автоматического анализа (${document.rawText.length.toLocaleString("ru-RU")} символов, лимит ${HARD_DOC_LIMIT.toLocaleString("ru-RU")}).`,
          code: "DOCUMENT_TOO_LARGE",
          textLength: document.rawText.length,
          limit: HARD_DOC_LIMIT,
        },
        { status: 413 }
      );
    }

    const analysis = await analyzeContract(document.rawText, userId);

    // Preserve the usedOcr flag from the original analysis — re-analysis
    // doesn't run OCR again; it works on already-recognised text.
    let previousMetadata: Record<string, unknown> = {};
    if (document.analysis?.metadata) {
      try {
        previousMetadata = JSON.parse(document.analysis.metadata);
      } catch {
        // ignore malformed metadata
      }
    }

    const metadata = JSON.stringify({
      contractType: analysis.contractType,
      parties: analysis.parties,
      notarization: analysis.notarization,
      registration: analysis.registration,
      missingClauses: analysis.missingClauses,
      preSigningChecklist: analysis.preSigningChecklist,
      isDemo: analysis.isDemo ?? false,
      usedOcr: previousMetadata.usedOcr ?? false,
      reanalyzedAt: new Date().toISOString(),
    });

    // Upsert the Analysis row — if we ever land in a state where the row is
    // missing, create it instead of failing.
    if (document.analysis) {
      await prisma.analysis.update({
        where: { id: document.analysis.id },
        data: {
          score: analysis.score,
          summary: analysis.summary,
          risks: JSON.stringify(analysis.risks),
          metadata,
        },
      });
    } else {
      await prisma.analysis.create({
        data: {
          documentId: document.id,
          score: analysis.score,
          summary: analysis.summary,
          risks: JSON.stringify(analysis.risks),
          metadata,
        },
      });
    }

    // Backfill chunk embeddings if this document was uploaded before semantic
    // search shipped (or if a previous embed attempt failed). Reanalysis
    // doesn't change rawText so we only embed when chunks are missing.
    const docId = document.id;
    const text = document.rawText;
    const alreadyEmbedded = await hasEmbeddings(docId).catch(() => false);
    if (!alreadyEmbedded) {
      void embedDocumentChunks(docId, text).catch((e) => {
        reportError(e, {
          op: "reanalyze.embed-chunks",
          userId,
          extra: { documentId: docId },
        });
      });
    }

    return NextResponse.json({
      ...analysis,
      documentId: document.id,
      fileName: document.fileName,
      textLength: document.rawText.length,
      hasOriginal: !!document.blobKey,
      usedOcr: previousMetadata.usedOcr ?? false,
    });
  } catch (error) {
    await reportError(error, { op: "reanalyze" });
    return NextResponse.json(
      { error: "Ошибка при повторном анализе. Попробуйте позже." },
      { status: 500 }
    );
  }
}
