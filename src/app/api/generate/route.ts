import { NextRequest, NextResponse } from "next/server";
import { generateAI, getActiveProvider } from "@/lib/ai/client";
import { GENERATE_DOCUMENT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { getTemplate } from "@/lib/templates";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, data } = body;

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

    return NextResponse.json({ document: response.text });
  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json(
      { error: "Ошибка при генерации документа. Попробуйте позже." },
      { status: 500 }
    );
  }
}
