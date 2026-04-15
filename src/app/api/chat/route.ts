import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `Ты — опытный юрист-консультант, специализирующийся на российском законодательстве. Ты помогаешь предпринимателям и малому бизнесу разобраться в юридических вопросах.

ПРАВИЛА:
1. Отвечай на русском языке
2. Ссылайся на конкретные статьи законов (ГК РФ, ТК РФ, НК РФ, КоАП РФ и др.)
3. Давай практичные, применимые советы
4. Структурируй ответ: ключевые моменты, детали, рекомендация
5. Если вопрос неоднозначен — укажи варианты и оговорки
6. В конце КАЖДОГО ответа добавляй дисклеймер: "⚠️ Данный ответ носит информационный характер и не является юридической консультацией."
7. Если вопрос не связан с юриспруденцией — вежливо сообщи, что специализируешься только на правовых вопросах

Отвечай структурированно, используя markdown для форматирования (жирный текст, списки, нумерация).`;

function hasApiKey(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return !!key && key !== "your-api-key-here";
}

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Сообщения не предоставлены" },
        { status: 400 }
      );
    }

    // If no API key — return demo indicator so frontend uses local responses
    if (!hasApiKey()) {
      return NextResponse.json({ demo: true });
    }

    const client = new Anthropic();

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ message: text });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Ошибка при обработке запроса. Попробуйте позже." },
      { status: 500 }
    );
  }
}
