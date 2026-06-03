import { generate, getActiveProvider } from "./client";
import { ANALYZE_CONTRACT_SYSTEM } from "./prompts";
import { EXTRACT_CHUNK_SYSTEM, SYNTHESIZE_SYSTEM } from "./synthesis-prompts";
import {
  AnalysisResultSchema,
  type AnalysisResult,
  type AnalysisRisk,
} from "./schemas/analyze";
import { ChunkRisksSchema, SynthesisSchema } from "./schemas/chunk";
import {
  chunkContract,
  isShortDocument,
  type Chunk,
} from "./chunking";
import { generateDemoAnalysis } from "./providers/demo";
import { logUsage } from "./usage";
import type { Usage } from "./types";
import { dedupRisks, byRiskSeverity } from "./dedup";
import { scoreAndVerdictFromCounts as calibrate } from "./score-calibration";
import { pickTier } from "./tier-policy";
import { verifyRiskQuotes } from "./quote-verify";
import { captureEvent } from "@/lib/analytics/server";

export type {
  AnalysisRisk,
  AnalysisResult,
  NotarizationInfo,
  RegistrationInfo,
} from "./schemas/analyze";

const MAP_CONCURRENCY = 4;
const MAX_RISKS_RETURNED = 8;
const MAX_RISKS_TO_SYNTHESIS = 15;
const PREAMBLE_CHARS = 8_000;

export async function analyzeContract(
  contractText: string,
  userId: string | null = null,
  orgId: string | null = null,
  /** Effective plan of the workspace owner. Drives the tier selector
   *  via tier-policy.ts — FREE/PRO get Sonnet, BUSINESS escalates to
   *  Opus on this step. Null = treat as FREE (safer for cost). */
  plan: string | null | undefined = null
): Promise<AnalysisResult> {
  if (getActiveProvider() === "demo") {
    return generateDemoAnalysis(contractText);
  }

  const tier = pickTier("analyze", plan);

  const result = isShortDocument(contractText)
    ? await analyzeSinglePass(contractText, userId, orgId, tier)
    : await analyzeMultiPass(contractText, userId, orgId, tier);

  // Snap each risk's quote to the contract's exact wording where it
  // differs only in whitespace — the report's apply-fix matches the
  // quote with an exact substring check, so a stray line break in the
  // model's citation would otherwise silently disable the fix button.
  return {
    ...result,
    risks: verifyRiskQuotes(contractText, result.risks, ({ level, clauseTitle }) => {
      // Fire-and-forget: a recovered quote stays usable, a paraphrased
      // one silently disables apply-fix — track the trend (PII-free:
      // only the risk level and the clause's own title flow through).
      void captureEvent({
        userId,
        event: "analyze.applyfix_unavailable",
        properties: { level, clauseTitle },
        orgId,
      });
    }),
  };
}

// ── Short doc: single pass against the full ANALYZE prompt ──────────

async function analyzeSinglePass(
  text: string,
  userId: string | null,
  orgId: string | null,
  tier: "fast" | "smart" | "deep"
): Promise<AnalysisResult> {
  // 8192 because the schema now carries verdict + verdictReason on top
  // of the original risks/missingClauses/checklist arrays, AND the
  // system prompt got the 14-trap checklist + a worked example. With
  // 4096 the model occasionally truncates the JSON object mid-array
  // and zod rejects the half-built result with "expected array,
  // received undefined" on the trailing fields. 8192 leaves plenty of
  // headroom on both Sonnet and Opus (their output cap is 8192).
  const result = await generate({
    schema: AnalysisResultSchema,
    system: ANALYZE_CONTRACT_SYSTEM,
    prompt: `Проанализируй следующий договор и найди все юридические риски:\n\n${text}`,
    model: tier,
    maxTokens: 8192,
    temperature: 0.1,
  });

  await logUsage(userId, orgId, result.usage, "analyze");
  return result.data;
}

// ── Long doc: map (chunks → risks) + reduce (preamble + risks → frame) ──

async function analyzeMultiPass(
  text: string,
  userId: string | null,
  orgId: string | null,
  tier: "fast" | "smart" | "deep"
): Promise<AnalysisResult> {
  const chunks = chunkContract(text);

  // Map phase: extract risks per chunk in parallel, capped concurrency.
  // Per-chunk extraction is intentionally pinned to "smart" (Sonnet)
  // even when the top-level tier is "deep" — Opus on every chunk would
  // be wildly expensive and the marginal accuracy gain is tiny on
  // single-chunk extraction. The reduce step gets the higher tier.
  const chunkRisks = await mapChunks(chunks, userId, orgId);

  // Flatten + dedup; sort by severity.
  const allRisks = dedupRisks(chunkRisks).sort(byRiskSeverity);

  // Reduce phase: ask AI to fill structural fields based on preamble + risks.
  const synthesis = await synthesizeStructure(text, allRisks, userId, orgId, tier);

  return {
    ...synthesis,
    risks: allRisks.slice(0, MAX_RISKS_RETURNED),
  };
}

async function mapChunks(
  chunks: Chunk[],
  userId: string | null,
  orgId: string | null
): Promise<AnalysisRisk[]> {
  const out: AnalysisRisk[] = [];

  for (let i = 0; i < chunks.length; i += MAP_CONCURRENCY) {
    const batch = chunks.slice(i, i + MAP_CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map((c) => extractRisksForChunk(c, userId, orgId))
    );

    for (const r of settled) {
      if (r.status === "fulfilled") {
        out.push(...r.value);
      } else {
        console.error("[analyze] chunk failed:", r.reason);
      }
    }
  }

  return out;
}

async function extractRisksForChunk(
  chunk: Chunk,
  userId: string | null,
  orgId: string | null
): Promise<AnalysisRisk[]> {
  // 4096 instead of 2048: with the expanded prompt (14 traps + worked
  // example) a chunk that genuinely contains 4-5 risks blows past 2k
  // output tokens, and the trailing risk gets cut. The risks array
  // is the only top-level field in ChunkRisksSchema so a partial
  // response means the entire chunk's worth of work is lost.
  const result = await generate({
    schema: ChunkRisksSchema,
    system: EXTRACT_CHUNK_SYSTEM,
    prompt: `Фрагмент договора (фрагмент ${chunk.index + 1}, символы ${chunk.startChar}-${chunk.endChar}):\n\n${chunk.text}`,
    model: "smart",
    maxTokens: 4096,
    temperature: 0.1,
  });

  await logUsage(userId, orgId, result.usage, "analyze");
  return result.data.risks;
}

async function synthesizeStructure(
  fullText: string,
  risks: AnalysisRisk[],
  userId: string | null,
  orgId: string | null,
  tier: "fast" | "smart" | "deep"
) {
  const preamble = fullText.slice(0, PREAMBLE_CHARS);
  const counts = {
    critical: risks.filter((r) => r.level === "critical").length,
    medium: risks.filter((r) => r.level === "medium").length,
    low: risks.filter((r) => r.level === "low").length,
  };

  const riskList = risks
    .slice(0, MAX_RISKS_TO_SYNTHESIS)
    .map(
      (r, i) =>
        `${i + 1}. [${r.level.toUpperCase()}] ${r.clauseTitle} (${r.clauseNumber}) — ${r.legalReference}`
    )
    .join("\n");

  const prompt = `═══ ПРЕАМБУЛА ДОГОВОРА (первые ${PREAMBLE_CHARS} символов) ═══

${preamble}

═══ СЧЁТЧИКИ РИСКОВ (для расчёта score) ═══

critical: ${counts.critical}
medium:   ${counts.medium}
low:      ${counts.low}
ВСЕГО:    ${risks.length}

═══ КРАТКИЙ СПИСОК НАЙДЕННЫХ РИСКОВ ═══

${riskList || "(рисков не найдено)"}

═══ ЗАДАЧА ═══

Собери целостное заключение по этому договору. Заполни все поля схемы.`;

  try {
    const result = await generate({
      schema: SynthesisSchema,
      system: SYNTHESIZE_SYSTEM,
      prompt,
      model: tier,
      // Synthesis output is small in the happy path (≈ 300-500 tokens
      // — type + parties + verdict + missingClauses + checklist) but
      // the addition of verdict / verdictReason / longer reasoning
      // bumped real responses to ~1500 tokens. Bumping to 4096 leaves
      // 2x headroom against truncation on Sonnet.
      maxTokens: 4096,
      temperature: 0.1,
    });

    await logUsage(userId, orgId, result.usage, "analyze");
    return result.data;
  } catch (e) {
    console.error("[analyze] synthesis failed, using fallback:", e);
    return fallbackSynthesis(preamble, counts, risks.length);
  }
}

function fallbackSynthesis(
  preamble: string,
  counts: { critical: number; medium: number; low: number },
  total: number
) {
  // Same calibration table the prompt uses, applied deterministically
  // when synthesis fails. Lifted into one helper so prompt and fallback
  // never drift apart.
  const { score, verdict, verdictReason } = calibrate(counts);

  const summary =
    verdict === "do_not_sign"
      ? `Договор содержит ${counts.critical} критичных и ${counts.medium} средних рисков. Подписывать в текущей редакции не рекомендуется.`
      : verdict === "negotiate"
        ? `Договор содержит ${counts.medium} замечаний средней значимости, рекомендуется устранить до подписания.`
        : `Явных рисков по автоматической проверке не обнаружено (${total} замечаний).`;

  return {
    score,
    summary,
    contractType: "Не определён автоматически",
    parties:
      preamble.match(/именуем\w+\s+в\s+дальнейшем\s+«[^»]+»/g)?.join(", ") ??
      "Стороны не определены автоматически",
    verdict,
    verdictReason,
    balance: {
      favor: "balanced" as const,
      comment:
        "Автоматическая оценка баланса сторон не завершилась — проверьте договор на односторонние права и санкции вручную.",
    },
    notarization: {
      required: false,
      reason:
        "Автоматическая проверка не выявила обязательных оснований для нотариального удостоверения. Проверьте по виду сделки (доли в ООО, рента, ипотека требуют нотариуса).",
    },
    registration: {
      required: false,
      reason:
        "Автоматическая проверка не выявила оснований для государственной регистрации. Проверьте отдельно — аренда недвижимости от 1 года и сделки с недвижимостью требуют регистрации в Росреестре.",
    },
    missingClauses: [
      "Чёткий порядок досрочного расторжения",
      "Конкретные сроки исполнения обязательств",
      "Порядок претензионного урегулирования споров",
    ],
    preSigningChecklist: [
      "Запросить выписку из ЕГРЮЛ/ЕГРИП контрагента не старше 30 дней",
      "Проверить полномочия подписанта (доверенность, устав, приказ)",
      "Сверить актуальность банковских реквизитов",
      "Проверить статус контрагента на kad.arbitr.ru и ЕФРСБ",
    ],
  };
}

// Internal usage type re-export to keep symbol surface stable.
export type { Usage };
