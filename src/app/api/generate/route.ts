import { NextRequest, NextResponse } from "next/server";
import { generateText, getActiveProvider } from "@/lib/ai/client";
import { GENERATE_DOCUMENT_SYSTEM } from "@/lib/ai/prompts";
import { logUsage } from "@/lib/ai/usage";
import { getTemplate } from "@/lib/templates";
import { rateLimit } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkQuotaSafe } from "@/lib/quota";
import { reportError } from "@/lib/telemetry";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
    const rl = await rateLimit(ip, "generate");
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

    const body = await request.json();
    const { templateId, data, documentName } = body;

    const template = getTemplate(templateId);
    if (!template) {
      return NextResponse.json(
        { error: "Шаблон не найден" },
        { status: 404 }
      );
    }

    if (getActiveProvider() === "demo") {
      return NextResponse.json({ demo: true });
    }

    const session = await auth();
    const userId = session?.user?.id ?? null;

    if (userId) {
      const quota = await checkQuotaSafe(userId, "generate");
      if (quota && !quota.allowed) {
        return NextResponse.json(
          {
            error: `Лимит тарифа ${quota.plan} исчерпан: ${quota.used} из ${quota.limit} генераций в этом месяце. Перейдите на тариф «Про» для безлимита.`,
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

    const fieldDescriptions = template.fields
      .map((f) => `${f.label}: ${data[f.id] || "не указано"}`)
      .join("\n");

    const result = await generateText({
      system: GENERATE_DOCUMENT_SYSTEM,
      prompt: `Сгенерируй документ: "${template.name}"\n\nДанные:\n${fieldDescriptions}\n\nСоздай полный, юридически грамотный документ, готовый к подписанию.`,
      model: "fast",
      maxTokens: 4096,
    });

    await logUsage(userId, result.usage, "generate");

    let savedDoc = null;
    if (userId) {
      savedDoc = await prisma.generatedDocument.create({
        data: {
          userId,
          templateId,
          name: documentName || template.name,
          content: result.data,
          formData: data,
        },
      });
    }

    return NextResponse.json({
      document: result.data,
      saved: !!savedDoc,
      id: savedDoc?.id,
    });
  } catch (error) {
    await reportError(error, { op: "generate" });
    return NextResponse.json(
      { error: "Ошибка при генерации документа. Попробуйте позже." },
      { status: 500 }
    );
  }
}
