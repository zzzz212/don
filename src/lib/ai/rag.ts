// Retrieval-Augmented Generation helper for the legal chat.
//
// Given a user question, retrieves the top-K most relevant LegalKnowledge
// articles and formats them as a context block to inject into the chat
// system prompt. The AI is then instructed to cite them in its answer.

import { vectorSearchLegal, type VectorHit } from "@/lib/legal-search";

const MAX_RETRIEVED = 5;
const MAX_FULLTEXT_CHARS_PER_ARTICLE = 2_500;

export interface LegalContext {
  hits: VectorHit[];
  /** Pre-formatted context block ready to append to the system prompt. */
  systemAppendix: string;
}

/**
 * Empty context — used when retrieval fails or finds nothing relevant.
 * Returns a stable shape so callers don't need to null-check.
 */
const EMPTY: LegalContext = { hits: [], systemAppendix: "" };

/**
 * Build a RAG context for a user's chat question. Always succeeds — returns
 * an empty context if embeddings aren't configured, the query yields no
 * hits, or anything goes wrong. The chat must work either way.
 */
export async function buildLegalContext(
  question: string
): Promise<LegalContext> {
  if (!question.trim()) return EMPTY;

  let hits: VectorHit[];
  try {
    hits = await vectorSearchLegal(question, MAX_RETRIEVED);
  } catch (e) {
    console.error("[rag] vectorSearchLegal failed:", (e as Error).message);
    return EMPTY;
  }

  if (hits.length === 0) return EMPTY;

  const systemAppendix = formatHitsForSystemPrompt(hits);
  return { hits, systemAppendix };
}

function formatHitsForSystemPrompt(hits: VectorHit[]): string {
  const blocks = hits.map((hit, i) => {
    const body = hit.fullText.slice(0, MAX_FULLTEXT_CHARS_PER_ARTICLE);
    const truncated =
      hit.fullText.length > MAX_FULLTEXT_CHARS_PER_ARTICLE ? "…" : "";
    const commentary = hit.commentary
      ? `\n  Комментарий: ${hit.commentary.slice(0, 600)}`
      : "";
    return `[${i + 1}] ${hit.code} — ${hit.title}\n  ${body}${truncated}${commentary}`;
  });

  return `

═══ КОНТЕКСТ: РЕЛЕВАНТНЫЕ СТАТЬИ ИЗ БАЗЫ ЗНАНИЙ ═══

Ниже приведены ${hits.length} статей из базы российского права, отобранных по релевантности к вопросу пользователя. Используй их при ответе:

${blocks.join("\n\n")}

═══ ИНСТРУКЦИИ ПО ИСПОЛЬЗОВАНИЮ КОНТЕКСТА ═══

1. ОПИРАЙСЯ на эти статьи в ответе, цитируй их формулировки.
2. Когда ссылаешься на статью — используй её код в квадратных скобках, например: «согласно [1] (ст. 450.1 ГК РФ)…»
3. Если ни одна из статей не релевантна вопросу — НЕ выдумывай ссылки на них. Лучше дай общий ответ без цитат.
4. Если статей недостаточно для полного ответа — отметь это, дополни общими принципами, но не ссылайся на несуществующие статьи.
`;
}
