import { NextRequest, NextResponse } from "next/server";
import { generateText, getActiveProvider } from "@/lib/ai/client";
import { GENERATE_DOCUMENT_SYSTEM } from "@/lib/ai/prompts";
import { logUsage } from "@/lib/ai/usage";
import { getTemplate } from "@/lib/templates";
import { rateLimit } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
    const rl = rateLimit(ip, "generate");
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Слишком много запросов. Подождите немного." },
        { status: 429 }
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
    console.error("Generation error:", error);
    return NextResponse.json(
      { error: "Ошибка при генерации документа. Попробуйте позже." },
      { status: 500 }
    );
  }
}
