import { NextRequest, NextResponse } from "next/server";
import { parseDocument } from "@/lib/parsers";
import { analyzeContract } from "@/lib/ai/analyze";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { checkQuotaSafe } from "@/lib/quota";

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

    // Parse the document
    let contractText: string;
    try {
      const parsed = await parseDocument(file);
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

    // Limit text length for API
    const truncatedText = contractText.slice(0, 15000);

    const analysis = await analyzeContract(truncatedText, userId ?? null);

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
              rawText: truncatedText,
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
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Ошибка при анализе документа. Попробуйте позже." },
      { status: 500 }
    );
  }
}
