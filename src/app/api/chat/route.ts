import { NextRequest, NextResponse } from "next/server";
import { chatAI, getActiveProvider } from "@/lib/ai/client";

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

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Сообщения не предоставлены" },
        { status: 400 }
      );
    }

    // If no AI provider — return demo indicator
    if (getActiveProvider() === "demo") {
      return NextResponse.json({ demo: true });
    }

    const response = await chatAI(
      SYSTEM_PROMPT,
      messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      2048
    );

    return NextResponse.json({ message: response.text });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Ошибка при обработке запроса. Попробуйте позже." },
      { status: 500 }
    );
  }
}
