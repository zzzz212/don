import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { generate } from "@/lib/ai/client";
import { MovesSchema } from "@/lib/ai/schemas/negotiation";
import { NEGOTIATION_MOVES_PROMPT } from "@/lib/ai/prompts";
import { pickTier } from "@/lib/ai/tier-policy";
import { getEffectiveUserPlan } from "@/lib/plans";
import { isOverFreeChatCap, FREE_CHAT_CAP } from "@/lib/ai/free-cap";
import { logUsage } from "@/lib/ai/usage";
import { reportError } from "@/lib/telemetry";
import { ensureActiveOrg } from "@/lib/org";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; clauseId: string }> }
) {
  try {
    const { id: dealId, clauseId } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const rl = await rateLimit(
      `negotiation.suggest:${userId}`,
      "negotiation.suggest"
    );
    if (!rl.ok) {
      return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
    }

    const orgId =
      session.user.activeOrgId ?? (await ensureActiveOrg(userId));

    // Verify sender owns this deal AND clause belongs to it.
    const clause = await prisma.dealClause.findFirst({
      where: {
        id: clauseId,
        dealId,
        deal: { ownerId: userId, orgId },
      },
      include: {
        deal: {
          include: {
            participants: { select: { id: true, role: true, guestName: true } },
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

    // Server-side gate: AI moves only make sense for disputed clauses.
    if (clause.status !== "DISPUTED") {
      return NextResponse.json(
        { error: "AI-предложения доступны только для спорных пунктов." },
        { status: 422 }
      );
    }

    // Cache hit: return cached moves unless ?force=1.
    const forceRegenerate = request.nextUrl.searchParams.get("force") === "1";
    if (!forceRegenerate && clause.suggestedMoves) {
      return NextResponse.json(clause.suggestedMoves);
    }

    // FREE plan cap: 10 chat-feature AiUsage rows per day.
    const owner = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, trialEndsAt: true },
    });
    const effectivePlan = owner
      ? getEffectiveUserPlan(owner).plan
      : "FREE";
    // FREE owners are capped at FREE_CHAT_CAP negotiation generations per
    // rolling 24h. The count lives here (DB), the threshold decision in
    // free-cap.ts so sender and receiver routes can't diverge. The cap is
    // enforced regardless of ?force=1 — force is cache-bypass only (#59).
    if (effectivePlan === "FREE") {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentCount = await prisma.aiUsage.count({
        where: {
          userId,
          feature: "chat", // negotiation uses chat tier — counted under chat
          createdAt: { gte: since },
        },
      });
      if (isOverFreeChatCap(effectivePlan, recentCount)) {
        return NextResponse.json(
          {
            error: `Лимит AI-предложений для тарифа FREE исчерпан (${FREE_CHAT_CAP} в день). Обновитесь до тарифа «Про».`,
            code: "NEGOTIATION_LIMIT",
          },
          { status: 402 }
        );
      }
    }

    // Build context for AI.
    const sender = clause.deal.participants.find((p) => p.role === "SENDER");
    const receiver = clause.deal.participants.find((p) => p.role === "RECEIVER");
    const yourSide = clause.yourSide as Record<string, unknown> | null;
    const theirSide = clause.theirSide as Record<string, unknown> | null;
    const commentHistory = clause.actions
      .filter((a) => a.kind === "COMMENT" && a.body)
      .map((a) => {
        const who =
          a.participant.role === "SENDER"
            ? `Отправитель ${sender?.guestName ?? ""}`
            : `Получатель ${receiver?.guestName ?? "(гость)"}`;
        return `${who.trim()}: ${a.body}`;
      })
      .join("\n");

    const prompt = `Текст пункта:\n${clause.text}\n\nПозиция клиента (отправителя):\n${JSON.stringify(yourSide, null, 2)}\n\nПозиция контрагента:\n${theirSide ? JSON.stringify(theirSide, null, 2) : "не сформирована"}\n\nИстория комментариев:\n${commentHistory || "пока нет"}\n\nСгенерируй 3 опции переговорных ходов для отправителя.`;

    const tier = pickTier("chat", effectivePlan);
    const result = await generate({
      schema: MovesSchema,
      system: NEGOTIATION_MOVES_PROMPT,
      prompt,
      model: tier,
      maxTokens: 1500,
    });

    await logUsage(userId, orgId, result.usage, "chat");

    // Cache on the clause for cheap subsequent reads.
    await prisma.dealClause.update({
      where: { id: clauseId },
      data: { suggestedMoves: result.data as unknown as object },
    });

    return NextResponse.json(result.data);
  } catch (error) {
    await reportError(error, { op: "negotiation.suggest.sender" });
    return NextResponse.json(
      { error: "Не удалось сгенерировать варианты" },
      { status: 500 }
    );
  }
}
