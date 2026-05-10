import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureActiveOrg, requireMembership, OrgAccessError } from "@/lib/org";
import { rateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/telemetry";
import { checkQuotaSafe } from "@/lib/quota";
import { logUsage } from "@/lib/ai/usage";
import { streamChat, getActiveProvider } from "@/lib/ai/client";
import { REFINE_DOCUMENT_SYSTEM } from "@/lib/ai/prompts";
import { SSE_HEADERS, streamToSSE } from "@/lib/ai/sse";
import { generateDiffSummary } from "@/lib/diff";
import type { StreamEvent } from "@/lib/ai/types";

// POST /api/generated/[id]/refine  { instruction: string }
//
// Streams an AI-rewritten version of the document according to the user's
// natural-language instruction, then commits it as a new DocumentVersion.
// Wire format is SSE — same as /api/chat — so the browser can render
// tokens as they arrive without waiting for the whole document.
//
// Quota: applies the "generate" plan limit (FREE: 2/month). Rate limit:
// uses the "generate" key (10/min/IP) — refinement is generation by
// another name and we don't want to give it a separate quota that could
// be farmed against the regular template path.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Требуется авторизация" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const userId = session.user.id;
    const orgId =
      session.user.activeOrgId ?? (await ensureActiveOrg(userId));

    // Workspace member check — anyone in the org with at least MEMBER
    // role can refine documents owned by the workspace.
    try {
      await requireMembership(userId, orgId, "MEMBER");
    } catch (e) {
      if (e instanceof OrgAccessError) {
        return NextResponse.json(
          { error: e.message },
          { status: e.status }
        );
      }
      throw e;
    }

    const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
    const rl = await rateLimit(ip, "generate");
    if (!rl.ok) {
      return NextResponse.json(
        {
          error:
            "Слишком много запросов. Подождите минуту и попробуйте снова.",
          code: "RATE_LIMITED",
        },
        { status: 429 }
      );
    }

    if (getActiveProvider() === "demo") {
      return NextResponse.json(
        {
          error:
            "AI-провайдер не настроен. Подключите ANTHROPIC_API_KEY или GEMINI_API_KEY.",
        },
        { status: 503 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      instruction?: unknown;
    };
    const instruction =
      typeof body.instruction === "string" ? body.instruction.trim() : "";

    if (instruction.length < 5) {
      return NextResponse.json(
        { error: "Опишите подробнее, что нужно изменить (минимум 5 символов)." },
        { status: 400 }
      );
    }
    if (instruction.length > 2000) {
      return NextResponse.json(
        {
          error:
            "Инструкция слишком длинная. Сократите до 2000 символов или разделите на несколько правок.",
        },
        { status: 400 }
      );
    }

    // Quota gate AFTER input validation — don't burn a quota slot on a
    // request that's going to fail validation.
    const quota = await checkQuotaSafe(orgId, "generate");
    if (quota && !quota.allowed) {
      return NextResponse.json(
        {
          error: `Лимит тарифа ${quota.plan} исчерпан: ${quota.used} из ${quota.limit} генераций в этом месяце. Перейдите на «Про» для безлимита.`,
          code: "QUOTA_EXCEEDED",
        },
        { status: 402 }
      );
    }

    const docRow = await prisma.generatedDocument.findFirst({
      where: { id, orgId },
      select: {
        id: true,
        name: true,
        content: true,
        formData: true,
        templateId: true,
      },
    });
    if (!docRow) {
      return NextResponse.json(
        { error: "Документ не найден" },
        { status: 404 }
      );
    }
    // Re-bind to a non-nullable local so the async generator below
    // can close over the value without TypeScript losing the
    // narrowing across the closure boundary.
    const doc = docRow;

    // Build the user message: full document + instruction. The system
    // prompt explains the contract; we just give the model the inputs.
    const userPrompt = `# ИСХОДНЫЙ ДОГОВОР\n\n${doc.content}\n\n# ИНСТРУКЦИЯ ПО ПРАВКЕ\n\n${instruction}`;

    const signal = request.signal;

    // Wrap streamChat so that we can:
    //   1. Buffer delta text into `accumulated` for the final save
    //   2. Log usage when the provider reports it
    //   3. Persist the new version atomically AFTER the stream completes
    //   4. Emit a custom "saved" event with versionNumber + versionId so
    //      the client can navigate or refresh state without an extra fetch
    //
    // The version commit happens server-side regardless of whether the
    // browser is still listening — once the provider has billed us for the
    // tokens we want to keep the result.
    async function* refineStream(): AsyncGenerator<StreamEvent> {
      let accumulated = "";

      try {
        const source = streamChat({
          system: REFINE_DOCUMENT_SYSTEM,
          messages: [{ role: "user", content: userPrompt }],
          model: "smart",
          maxTokens: 8192,
          signal,
        });

        for await (const event of source) {
          if (event.kind === "delta") {
            accumulated += event.text;
          }
          if (event.kind === "usage") {
            void logUsage(userId, orgId, event.usage, "generate");
          }
          if (event.kind === "error") {
            await reportError(new Error(event.message), {
              op: "generated.refine.stream",
              userId,
              tags: { docId: id },
            });
          }
          yield event;
        }
      } catch (e) {
        await reportError(e, {
          op: "generated.refine.stream",
          userId,
          tags: { docId: id },
        });
        yield { kind: "error", message: (e as Error).message };
        return;
      }

      // Defensive: don't try to save an empty / suspiciously short
      // result. Most useful refinements produce 1k+ characters; under
      // 200 is almost certainly a model failure or a "I refuse" answer.
      if (accumulated.trim().length < 200) {
        yield {
          kind: "error",
          message:
            "AI вернул слишком короткий ответ. Попробуйте переформулировать инструкцию.",
        };
        return;
      }

      try {
        const safeFormData =
          doc.formData && typeof doc.formData === "object"
            ? (doc.formData as Record<string, string>)
            : {};
        const summary = generateDiffSummary(doc.content, accumulated);
        // Truncate the instruction at 80 chars for the changes summary
        // headline — full instruction stays in the prompt but the UI
        // line should fit on one row.
        const headline =
          instruction.length <= 80
            ? instruction
            : `${instruction.slice(0, 77)}…`;

        const newVersion = await prisma.$transaction(async (tx) => {
          const last = await tx.documentVersion.findFirst({
            where: { generatedDocId: id },
            orderBy: { versionNumber: "desc" },
            select: { versionNumber: true },
          });
          const nextVersionNumber = (last?.versionNumber ?? 0) + 1;

          const created = await tx.documentVersion.create({
            data: {
              generatedDocId: id,
              versionNumber: nextVersionNumber,
              title: `AI: ${headline}`,
              content: accumulated,
              formData: safeFormData,
              changesSummary: `AI-доработка: «${headline}». ${summary}`,
              createdBy: userId,
            },
            select: { id: true, versionNumber: true },
          });

          await tx.generatedDocument.update({
            where: { id },
            data: { content: accumulated },
          });

          return created;
        });

        yield {
          kind: "saved",
          payload: {
            documentId: id,
            versionId: newVersion.id,
            versionNumber: newVersion.versionNumber,
          },
        };
      } catch (e) {
        await reportError(e, {
          op: "generated.refine.persist",
          userId,
          tags: { docId: id },
        });
        yield {
          kind: "error",
          message:
            "AI завершил работу, но мы не смогли сохранить версию. Попробуйте ещё раз.",
        };
      }
    }

    return new Response(streamToSSE(refineStream()), {
      status: 200,
      headers: SSE_HEADERS,
    });
  } catch (error) {
    await reportError(error, { op: "generated.refine" });
    return NextResponse.json(
      { error: "Не удалось запустить AI-доработку. Попробуйте позже." },
      { status: 500 }
    );
  }
}
