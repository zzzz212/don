import { NextRequest, NextResponse } from "next/server";
import { streamChat, getActiveProvider } from "@/lib/ai/client";
import { CHAT_SYSTEM } from "@/lib/ai/prompts";
import { logUsage } from "@/lib/ai/usage";
import { SSE_HEADERS, streamToSSE } from "@/lib/ai/sse";
import type { StreamEvent } from "@/lib/ai/types";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/telemetry";
import { ensureActiveOrg } from "@/lib/org";

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
    const orgId = userId
      ? session?.user?.activeOrgId ?? (await ensureActiveOrg(userId))
      : null;

    // (RAG removed — see commit dropping /legal. The 6-article seed
    // wasn't enough corpus for citation to be useful, and Anthropic's
    // base model already knows ГК РФ well enough to answer freely.
    // pgvector + Voyage stay in place for the per-user contract
    // semantic search on the dashboard.)

    // The browser cancels the fetch when the user navigates away or hits
    // stop. request.signal is forwarded into the AI SDK so we stop the
    // upstream call and stop billing tokens.
    const signal = request.signal;

    // Wrap the provider stream so that:
    //   1. usage events are recorded to AiUsage on the way through
    //   2. error events get telemetry attribution
    //   3. delta / done events pass through untouched to the client
    async function* withTelemetry(): AsyncGenerator<StreamEvent> {
      const source = streamChat({
        system: CHAT_SYSTEM,
        messages: messages.map((m: { role: string; content: string }) => ({
          role:
            m.role === "assistant"
              ? ("assistant" as const)
              : ("user" as const),
          content: m.content,
        })),
        maxTokens: 2048,
        signal,
      });

      for await (const event of source) {
        if (event.kind === "usage") {
          // Fire-and-forget DB write so we don't block the stream.
          void logUsage(userId, orgId, event.usage, "chat");
        }
        if (event.kind === "error") {
          await reportError(new Error(event.message), {
            op: "chat.stream",
            userId,
          });
        }
        yield event;
      }
    }

    return new Response(streamToSSE(withTelemetry()), {
      status: 200,
      headers: SSE_HEADERS,
    });
  } catch (error) {
    await reportError(error, { op: "chat" });
    return NextResponse.json(
      { error: "Ошибка при обработке запроса. Попробуйте позже." },
      { status: 500 }
    );
  }
}
