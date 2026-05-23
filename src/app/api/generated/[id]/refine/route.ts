import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureActiveOrg, requireMembership, OrgAccessError } from "@/lib/org";
import { rateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/telemetry";
import { checkQuotaSafe } from "@/lib/quota";
import { logUsage } from "@/lib/ai/usage";
import { generateText, streamChat, getActiveProvider } from "@/lib/ai/client";
import { pickTier } from "@/lib/ai/tier-policy";
import {
  REFINE_DOCUMENT_SYSTEM,
  REFINE_PATCH_SYSTEM,
} from "@/lib/ai/prompts";
import { SSE_HEADERS, streamToSSE } from "@/lib/ai/sse";
import { generateDiffSummary } from "@/lib/diff";
import type { StreamEvent } from "@/lib/ai/types";
import {
  RefinePatchSchema,
  type RefinePatch,
} from "@/lib/ai/schemas/refine-patch";
import {
  applyRefinePatch,
  type RefineOperation,
} from "@/lib/contracts/patch";
import { captureEvent } from "@/lib/analytics/server";

// Strip markdown / prose around a JSON object so we can z.parse it. AI
// providers vary on JSON-mode strictness — some return ```json ...```
// blocks, some prepend "Конечно, вот JSON:". Find the outermost { ... }.
function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

// POST /api/generated/[id]/refine  { instruction: string, mode?: "auto" | "regen" }
//
// Two execution paths:
//
//   1. PATCH MODE (default, cheap):
//      AI returns a small JSON of edit operations against the source
//      document (`replace`/`insert_after`/`insert_before`/`delete` with
//      anchor strings). Server applies the operations and saves the
//      result. Output tokens are typically 5-10x smaller than full
//      regen — for a 12 KB contract that's the difference between
//      ~3000 output tokens and ~300.
//
//   2. REGEN MODE (fallback OR explicit):
//      AI streams a full rewritten document (the original behavior).
//      Used when:
//        • patch mode returns refused=true (illegal/too-large edit)
//        • patch mode produces a structurally invalid response
//        • any operation's anchor doesn't match the document
//        • the client explicitly requests mode="regen"
//
// Both paths share the same SSE wire format. The client distinguishes
// them via the "mode" event we emit at the start of each path.

// Regen-mode streams the whole rewritten contract — 80-150s on long
// documents. Patch mode is usually <15s but the route serves both.
export const maxDuration = 300;

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
      mode?: unknown;
    };
    const instruction =
      typeof body.instruction === "string" ? body.instruction.trim() : "";
    const requestedMode = body.mode === "regen" ? "regen" : "auto";

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

    const quota = await checkQuotaSafe(orgId, "generate");
    const effectivePlan = quota?.plan ?? null;
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
    const doc = docRow;
    const userPrompt = `# ИСХОДНЫЙ ДОГОВОР\n\n${doc.content}\n\n# ИНСТРУКЦИЯ ПО ПРАВКЕ\n\n${instruction}`;
    const signal = request.signal;

    async function* refineStream(): AsyncGenerator<StreamEvent> {
      // ── Path 1: patch mode (cheap) ──────────────────────────
      if (requestedMode === "auto") {
        yield { kind: "mode", mode: "patch" };

        // Use generateText (not generate(zod)) to avoid two costly bits
        // that show up on Groq specifically:
        //   • generate(zod) auto-appends a ~700-1000 token JSON-Schema
        //     dump to the system prompt — we already inlined the JSON
        //     shape in REFINE_PATCH_SYSTEM, so the dump is dead weight.
        //   • generate() does an automatic 2nd full call with retry
        //     instructions on JSON parse failure — that doubles input
        //     tokens. We'd rather fall through to regen on first
        //     failure, which is cheaper than a retry that often fails
        //     anyway on Llama 70B.
        let patch: RefinePatch | null = null;
        let parseFailReason: string | null = null;
        try {
          const result = await generateText({
            system: REFINE_PATCH_SYSTEM,
            prompt: userPrompt,
            model: pickTier("refine", effectivePlan),
            temperature: 0.2,
            maxTokens: 2048,
          });
          void logUsage(userId, orgId, result.usage, "generate");

          const raw = extractJsonObject(result.data);
          if (!raw) {
            parseFailReason = "AI не вернул JSON-объект";
          } else {
            try {
              const parsedJson = JSON.parse(raw);
              const parsed = RefinePatchSchema.safeParse(parsedJson);
              if (parsed.success) {
                patch = parsed.data;
              } else {
                parseFailReason = `JSON не соответствует схеме: ${parsed.error.issues
                  .slice(0, 2)
                  .map((i) => i.message)
                  .join("; ")}`;
              }
            } catch (jsonErr) {
              parseFailReason = `Невалидный JSON: ${(jsonErr as Error).message}`;
            }
          }
        } catch (e) {
          await reportError(e, {
            op: "generated.refine.patch",
            userId,
            tags: { docId: id },
          });
          parseFailReason =
            (e as Error).message ?? "AI запрос для точечной правки упал";
        }

        if (patch === null) {
          yield {
            kind: "mode",
            mode: "regen",
            reason:
              parseFailReason ??
              "Не удалось получить точечный патч — переключаемся на полную перегенерацию.",
          };
          yield* runRegenAndPersist({ doc, userPrompt, userId, orgId, plan: effectivePlan, signal });
          return;
        }

        if (patch.refused) {
          yield {
            kind: "mode",
            mode: "regen",
            reason: patch.refusalReason
              ? `AI: ${patch.refusalReason} Переключаемся на полную перегенерацию.`
              : "AI отказался выполнять точечную правку — переключаемся на полную перегенерацию.",
          };
          yield* runRegenAndPersist({ doc, userPrompt, userId, orgId, plan: effectivePlan, signal });
          return;
        }

        const apply = applyRefinePatch(
          doc.content,
          patch.operations as RefineOperation[]
        );
        if (!apply.ok) {
          // Anchor mismatch — most common failure mode. Tell the user
          // we're falling back instead of just succeeding silently
          // with the wrong result.
          yield {
            kind: "mode",
            mode: "regen",
            reason: `Не удалось применить точечную правку (${apply.reason}) — переключаемся на полную перегенерацию.`,
          };
          yield* runRegenAndPersist({ doc, userPrompt, userId, orgId, plan: effectivePlan, signal });
          return;
        }

        // Patch succeeded — persist and emit the saved event. No
        // streaming text payload for this path; the UI fetches the
        // updated document on reload.
        try {
          const saved = await persistNewVersion({
            docId: id,
            userId,
            originalContent: doc.content,
            newContent: apply.result,
            originalFormData: doc.formData,
            instruction,
            summaryFromAi: patch.summary,
            opsApplied: apply.appliedOps,
          });
          void captureEvent({
            userId,
            orgId,
            event: "document_refined",
            properties: {
              mode: "patch",
              opsApplied: apply.appliedOps.length,
              versionNumber: saved.versionNumber,
              templateId: doc.templateId,
            },
          });
          yield {
            kind: "saved",
            payload: {
              documentId: id,
              versionId: saved.id,
              versionNumber: saved.versionNumber,
              mode: "patch",
              opsApplied: apply.appliedOps.length,
            },
          };
          return;
        } catch (e) {
          await reportError(e, {
            op: "generated.refine.persist",
            userId,
            tags: { docId: id, mode: "patch" },
          });
          yield {
            kind: "error",
            message:
              "Правка применена, но сохранить версию не удалось. Попробуйте ещё раз.",
          };
          return;
        }
      }

      // ── Path 2: regen mode (explicit) ─────────────────────────
      yield { kind: "mode", mode: "regen" };
      yield* runRegenAndPersist({ doc, userPrompt, userId, orgId, plan: effectivePlan, signal });
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

// ── Helpers ────────────────────────────────────────────────────

interface RegenArgs {
  doc: {
    id: string;
    name: string;
    content: string;
    formData: unknown;
    templateId: string;
  };
  userPrompt: string;
  userId: string;
  orgId: string;
  /** Effective plan (FREE / PRO / BUSINESS). Drives which Claude tier
   *  the regen call uses via tier-policy.ts. */
  plan: string | null;
  signal: AbortSignal;
}

/**
 * Streaming full-regen path. Wraps streamChat, accumulates tokens, and
 * commits a new DocumentVersion atomically when the stream completes.
 */
async function* runRegenAndPersist(
  args: RegenArgs
): AsyncGenerator<StreamEvent> {
  const { doc, userPrompt, userId, orgId, plan, signal } = args;
  let accumulated = "";

  try {
    const source = streamChat({
      system: REFINE_DOCUMENT_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
      model: pickTier("refine", plan),
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
          op: "generated.refine.regen.stream",
          userId,
          tags: { docId: doc.id },
        });
      }
      yield event;
    }
  } catch (e) {
    await reportError(e, {
      op: "generated.refine.regen.stream",
      userId,
      tags: { docId: doc.id },
    });
    yield { kind: "error", message: (e as Error).message };
    return;
  }

  if (accumulated.trim().length < 200) {
    yield {
      kind: "error",
      message:
        "AI вернул слишком короткий ответ. Попробуйте переформулировать инструкцию.",
    };
    return;
  }

  try {
    const saved = await persistNewVersion({
      docId: doc.id,
      userId,
      originalContent: doc.content,
      newContent: accumulated,
      originalFormData: doc.formData,
      instruction: userPrompt,
      mode: "regen",
    });
    void captureEvent({
      userId,
      orgId,
      event: "document_refined",
      properties: {
        mode: "regen",
        versionNumber: saved.versionNumber,
        templateId: doc.templateId,
      },
    });
    yield {
      kind: "saved",
      payload: {
        documentId: doc.id,
        versionId: saved.id,
        versionNumber: saved.versionNumber,
        mode: "regen",
      },
    };
  } catch (e) {
    await reportError(e, {
      op: "generated.refine.persist",
      userId,
      tags: { docId: doc.id, mode: "regen" },
    });
    yield {
      kind: "error",
      message:
        "AI завершил работу, но мы не смогли сохранить версию. Попробуйте ещё раз.",
    };
  }
}

interface PersistArgs {
  docId: string;
  userId: string;
  originalContent: string;
  newContent: string;
  originalFormData: unknown;
  instruction: string;
  /** Used in the version title prefix. */
  mode?: "patch" | "regen";
  /** Pre-computed summary from the AI (patch mode only). */
  summaryFromAi?: string;
  /** Ops list for patch-mode summary. */
  opsApplied?: Array<{ op: string; preview: string }>;
}

async function persistNewVersion(args: PersistArgs) {
  const safeFormData =
    args.originalFormData && typeof args.originalFormData === "object"
      ? (args.originalFormData as Record<string, string>)
      : {};

  const headline =
    args.summaryFromAi && args.summaryFromAi.length > 0
      ? args.summaryFromAi.length <= 80
        ? args.summaryFromAi
        : `${args.summaryFromAi.slice(0, 77)}…`
      : args.instruction.length <= 80
        ? args.instruction
        : `${args.instruction.slice(0, 77)}…`;

  const baseSummary = generateDiffSummary(args.originalContent, args.newContent);
  const opsLine = args.opsApplied
    ? args.opsApplied.map((o) => o.preview).join("; ")
    : "";

  const changesSummary = args.opsApplied
    ? `AI-правка (${args.opsApplied.length} ${pluralize(args.opsApplied.length, ["операция", "операции", "операций"])}): ${opsLine}. ${baseSummary}`
    : `AI-доработка: «${headline}». ${baseSummary}`;

  return prisma.$transaction(async (tx) => {
    const last = await tx.documentVersion.findFirst({
      where: { generatedDocId: args.docId },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });
    const nextVersionNumber = (last?.versionNumber ?? 0) + 1;

    const created = await tx.documentVersion.create({
      data: {
        generatedDocId: args.docId,
        versionNumber: nextVersionNumber,
        title: `AI: ${headline}`,
        content: args.newContent,
        formData: safeFormData,
        changesSummary,
        createdBy: args.userId,
      },
      select: { id: true, versionNumber: true },
    });

    await tx.generatedDocument.update({
      where: { id: args.docId },
      data: { content: args.newContent },
    });

    return created;
  });
}

function pluralize(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}
