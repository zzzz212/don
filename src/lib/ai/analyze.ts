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

const RISK_PRIORITY: Record<AnalysisRisk["level"], number> = {
  critical: 0,
  medium: 1,
  low: 2,
};

export async function analyzeContract(
  contractText: string,
  userId: string | null = null
): Promise<AnalysisResult> {
  if (getActiveProvider() === "demo") {
    return generateDemoAnalysis(contractText);
  }

  if (isShortDocument(contractText)) {
    return analyzeSinglePass(contractText, userId);
  }

  return analyzeMultiPass(contractText, userId);
}

// ── Short doc: single pass against the full ANALYZE prompt ──────────

async function analyzeSinglePass(
  text: string,
  userId: string | null
): Promise<AnalysisResult> {
  const result = await generate({
    schema: AnalysisResultSchema,
    system: ANALYZE_CONTRACT_SYSTEM,
    prompt: `Проанализируй следующий договор и найди все юридические риски:\n\n${text}`,
    model: "smart",
    maxTokens: 4096,
    temperature: 0.1,
  });

  await logUsage(userId, result.usage, "analyze");
  return result.data;
}

// ── Long doc: map (chunks → risks) + reduce (preamble + risks → frame) ──

async function analyzeMultiPass(
  text: string,
  userId: string | null
): Promise<AnalysisResult> {
  const chunks = chunkContract(text);

  // Map phase: extract risks per chunk in parallel, capped concurrency.
  const chunkRisks = await mapChunks(chunks, userId);

  // Flatten + dedup; sort by severity.
  const allRisks = dedupRisks(chunkRisks).sort(byRiskSeverity);

  // Reduce phase: ask AI to fill structural fields based on preamble + risks.
  const synthesis = await synthesizeStructure(text, allRisks, userId);

  return {
    ...synthesis,
    risks: allRisks.slice(0, MAX_RISKS_RETURNED),
  };
}

async function mapChunks(
  chunks: Chunk[],
  userId: string | null
): Promise<AnalysisRisk[]> {
  const out: AnalysisRisk[] = [];

  for (let i = 0; i < chunks.length; i += MAP_CONCURRENCY) {
    const batch = chunks.slice(i, i + MAP_CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map((c) => extractRisksForChunk(c, userId))
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
  userId: string | null
): Promise<AnalysisRisk[]> {
  const result = await generate({
    schema: ChunkRisksSchema,
    system: EXTRACT_CHUNK_SYSTEM,
    prompt: `Фрагмент договора (фрагмент ${chunk.index + 1}, символы ${chunk.startChar}-${chunk.endChar}):\n\n${chunk.text}`,
    model: "smart",
    maxTokens: 2048,
    temperature: 0.1,
  });

  await logUsage(userId, result.usage, "analyze");
  return result.data.risks;
}

function dedupRisks(risks: AnalysisRisk[]): AnalysisRisk[] {
  const seen = new Map<string, AnalysisRisk>();

  for (const risk of risks) {
    const key = riskDedupKey(risk);
    const existing = seen.get(key);

    if (!existing || RISK_PRIORITY[risk.level] < RISK_PRIORITY[existing.level]) {
      seen.set(key, risk);
    }
  }

  return Array.from(seen.values());
}

function riskDedupKey(risk: AnalysisRisk): string {
  const original = risk.originalText.trim().slice(0, 50).toLowerCase();
  const number = risk.clauseNumber.trim().toLowerCase();
  return `${number}|${original}`;
}

function byRiskSeverity(a: AnalysisRisk, b: AnalysisRisk): number {
  return RISK_PRIORITY[a.level] - RISK_PRIORITY[b.level];
}

async function synthesizeStructure(
  fullText: string,
  risks: AnalysisRisk[],
  userId: string | null
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
      model: "smart",
      maxTokens: 2048,
      temperature: 0.1,
    });

    await logUsage(userId, result.usage, "analyze");
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
  const score = Math.max(
    1,
    Math.min(
      10,
      Math.round(10 - counts.critical * 2 - counts.medium - counts.low * 0.5)
    )
  );

  const verdict =
    counts.critical > 0
      ? `Договор содержит ${counts.critical} критичных и ${counts.medium} средних рисков. Подписывать в текущей редакции не рекомендуется.`
      : counts.medium > 0
        ? `Договор содержит ${counts.medium} замечаний средней значимости, рекомендуется устранить до подписания.`
        : `Явных рисков по автоматической проверке не обнаружено (${total} замечаний).`;

  return {
    score,
    summary: verdict,
    contractType: "Не определён автоматически",
    parties:
      preamble.match(/именуем\w+\s+в\s+дальнейшем\s+«[^»]+»/g)?.join(", ") ??
      "Стороны не определены автоматически",
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

// Re-export for tests / callers that want to inspect chunks separately.
export { chunkContract } from "./chunking";

// Internal usage type re-export to keep symbol surface stable.
export type { Usage };
