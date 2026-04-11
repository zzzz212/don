import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
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

    // Build a description of what to generate
    const fieldDescriptions = template.fields
      .map((f) => `${f.label}: ${data[f.id] || "не указано"}`)
      .join("\n");

    const client = new Anthropic();

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: GENERATE_DOCUMENT_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Сгенерируй документ: "${template.name}"\n\nДанные:\n${fieldDescriptions}\n\nСоздай полный, юридически грамотный документ, готовый к подписанию.`,
        },
      ],
    });

    const documentText =
      message.content[0].type === "text" ? message.content[0].text : "";

    return NextResponse.json({ document: documentText });
  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json(
      { error: "Ошибка при генерации документа. Попробуйте позже." },
      { status: 500 }
    );
  }
}
