import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { getOrCreateDealSessionId } from "@/lib/deal-session";
import { generate } from "@/lib/ai/client";
import { MovesSchema } from "@/lib/ai/schemas/negotiation";
import { NEGOTIATION_MOVES_PROMPT } from "@/lib/ai/prompts";
import { pickTier } from "@/lib/ai/tier-policy";
import { reportError } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ token: string; clauseId: string }> }
) {
  try {
    const { token, clauseId } = await params;
    const { sessionId } = await getOrCreateDealSessionId();

    const rl = await rateLimit(
      `negotiation.suggest:${sessionId}`,
      "negotiation.suggest"
    );
    if (!rl.ok) {
      return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
    }

    const clause = await prisma.dealClause.findFirst({
      where: {
        id: clauseId,
        deal: { inviteToken: token },
      },
      include: {
        deal: {
          include: {
            participants: { select: { id: true, role: true, guestName: true, sessionId: true } },
          },
        },
        actions: {
          orderBy: { createdAt: "asc" },
          include: {
            participant: { select: { role: true, guestName: true } },
          },
        },
      },
    });
    if (!clause) {
      return NextResponse.json({ error: "Не найдено" }, { status: 404 });
    }

    // Verify the session is the claimed RECEIVER for this deal.
    const receiver = clause.deal.participants.find((p) => p.role === "RECEIVER");
    if (!receiver || receiver.sessionId !== sessionId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Receiver perspective uses cache too — but cached value reflects whoever
    // requested it last. To avoid cross-pollution, key the cache by perspective:
    // store as { sender?: Moves, receiver?: Moves } once we have a real two-sided
    // flow (Sub-B). For Sub-A: cache holds receiver's moves, regenerated on force.
    const forceRegenerate = request.nextUrl.searchParams.get("force") === "1";

    const sender = clause.deal.participants.find((p) => p.role === "SENDER");
    const yourSide = clause.yourSide as Record<string, unknown> | null;
    const theirSide = clause.theirSide as Record<string, unknown> | null;

    // Receiver sees the inverted perspective — their position is the
    // "counter" side from the analyze, so swap in the prompt context.
    const commentHistory = clause.actions
      .filter((a) => a.kind === "COMMENT" && a.body)
      .map((a) => {
        const who =
          a.participant.role === "SENDER"
            ? `Отправитель ${sender?.guestName ?? ""}`
            : `Получатель ${receiver.guestName ?? "(гость)"}`;
        return `${who.trim()}: ${a.body}`;
      })
      .join("\n");

    const prompt = `Текст пункта:\n${clause.text}\n\nПозиция клиента (получателя):\n${theirSide ? JSON.stringify(theirSide, null, 2) : "не сформирована — клиент видит позицию отправителя"}\n\nПозиция контрагента (отправителя):\n${JSON.stringify(yourSide, null, 2)}\n\nИстория комментариев:\n${commentHistory || "пока нет"}\n\nСгенерируй 3 опции переговорных ходов для получателя.`;

    // Receiver session uses the SENDER owner's tier (deal context) —
    // anonymous receivers don't have their own quota.
    const tier = pickTier("chat", null);

    if (!forceRegenerate && clause.suggestedMoves) {
      return NextResponse.json(clause.suggestedMoves);
    }

    const result = await generate({
      schema: MovesSchema,
      system: NEGOTIATION_MOVES_PROMPT,
      prompt,
      model: tier,
      maxTokens: 1500,
    });

    await prisma.dealClause.update({
      where: { id: clauseId },
      data: { suggestedMoves: result.data as unknown as object },
    });

    return NextResponse.json(result.data);
  } catch (error) {
    await reportError(error, { op: "negotiation.suggest.receiver" });
    return NextResponse.json(
      { error: "Не удалось сгенерировать варианты" },
      { status: 500 }
    );
  }
}
