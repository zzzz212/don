import { NextRequest, NextResponse } from "next/server";
import { chat, getActiveProvider } from "@/lib/ai/client";
import { CHAT_SYSTEM } from "@/lib/ai/prompts";
import { logUsage } from "@/lib/ai/usage";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/telemetry";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
    const rl = await rateLimit(ip, "chat");
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

    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Сообщения не предоставлены" },
        { status: 400 }
      );
    }

    if (getActiveProvider() === "demo") {
      return NextResponse.json({ demo: true });
    }

    const session = await auth();
    const userId = session?.user?.id ?? null;

    const result = await chat({
      system: CHAT_SYSTEM,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      })),
      maxTokens: 2048,
    });

    await logUsage(userId, result.usage, "chat");

    return NextResponse.json({ message: result.text });
  } catch (error) {
    await reportError(error, { op: "chat" });
    return NextResponse.json(
      { error: "Ошибка при обработке запроса. Попробуйте позже." },
      { status: 500 }
    );
  }
}
