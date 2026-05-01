import { NextRequest, NextResponse } from "next/server";
import { generateAI, getActiveProvider } from "@/lib/ai/client";
import { GENERATE_DOCUMENT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
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

    // If no AI provider — tell frontend to use local generation
    if (getActiveProvider() === "demo") {
      return NextResponse.json({ demo: true });
    }

    // Build a description of what to generate
    const fieldDescriptions = template.fields
      .map((f) => `${f.label}: ${data[f.id] || "не указано"}`)
      .join("\n");

    const response = await generateAI(
      GENERATE_DOCUMENT_SYSTEM_PROMPT,
      `Сгенерируй документ: "${template.name}"\n\nДанные:\n${fieldDescriptions}\n\nСоздай полный, юридически грамотный документ, готовый к подписанию.`,
      4096
    );

    // Save to DB if user is authenticated
    const session = await auth();
    let savedDoc = null;

    if (session?.user?.id) {
      savedDoc = await prisma.generatedDocument.create({
        data: {
          userId: session.user.id,
          templateId,
          templateCode: templateId, // Use templateId as code for legacy templates
          name: documentName || template.name,
          content: response.text,
          formData: data,
        },
      });
    }

    return NextResponse.json({
      document: response.text,
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
