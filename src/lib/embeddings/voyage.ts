import {
  EmbeddingError,
  type EmbeddingInputType,
  type EmbeddingProvider,
  type EmbeddingResult,
} from "./types";

// Voyage AI — Anthropic-recommended embeddings provider with strong Russian
// quality. voyage-3-large is the current best model: 1024 dim, multilingual,
// 32k token context. Free tier: 200M tokens/month for new accounts.
//
// Docs: https://docs.voyageai.com/

const MODEL = "voyage-3-large";
const DIMENSIONS = 1024;
// Voyage docs allow 32k tokens per input; ~3 chars/token in Russian.
// We cap a bit lower to leave headroom.
const MAX_INPUT_CHARS = 90_000;
// Single-batch endpoint accepts up to 1000 inputs.
const MAX_BATCH_SIZE = 128;

function getKey(): string | null {
  const key = process.env.VOYAGE_API_KEY;
  if (!key || key === "your-voyage-api-key-here") return null;
  return key;
}

interface VoyageRawEmbedding {
  embedding: number[];
  index: number;
}

interface VoyageRawResponse {
  data: VoyageRawEmbedding[];
  usage: { total_tokens: number };
}

async function getClient() {
  const { VoyageAIClient } = await import("voyageai");
  return new VoyageAIClient({ apiKey: getKey()! });
}

function truncate(text: string): string {
  return text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;
}

export const voyageEmbeddingProvider: EmbeddingProvider = {
  name: "voyage",
  dimensions: DIMENSIONS,
  maxInputChars: MAX_INPUT_CHARS,

  get available() {
    return getKey() !== null;
  },

  async embed(
    text: string,
    inputType: EmbeddingInputType
  ): Promise<EmbeddingResult> {
    if (!getKey()) {
      throw new EmbeddingError(
        "VOYAGE_API_KEY is not configured",
        "voyage",
        "NOT_CONFIGURED"
      );
    }
    if (!text || !text.trim()) {
      throw new EmbeddingError("Empty input", "voyage", "EMPTY_INPUT");
    }

    const [result] = await this.embedBatch([text], inputType);
    return result;
  },

  async embedBatch(
    texts: string[],
    inputType: EmbeddingInputType
  ): Promise<EmbeddingResult[]> {
    if (!getKey()) {
      throw new EmbeddingError(
        "VOYAGE_API_KEY is not configured",
        "voyage",
        "NOT_CONFIGURED"
      );
    }
    if (texts.length === 0) return [];
    if (texts.length > MAX_BATCH_SIZE) {
      // Recurse in chunks rather than failing — caller-friendly.
      const out: EmbeddingResult[] = [];
      for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
        const slice = texts.slice(i, i + MAX_BATCH_SIZE);
        out.push(...(await this.embedBatch(slice, inputType)));
      }
      return out;
    }

    const trimmed = texts.map((t) => truncate(t.trim()));
    if (trimmed.some((t) => t.length === 0)) {
      throw new EmbeddingError(
        "One or more inputs are empty",
        "voyage",
        "EMPTY_INPUT"
      );
    }

    try {
      const client = await getClient();
      const response = (await client.embed({
        input: trimmed,
        model: MODEL,
        inputType,
      })) as unknown as VoyageRawResponse;

      // Voyage returns embeddings in input order with `index` field as a
      // safety check. Sort by index in case the SDK's typing diverges.
      const sorted = [...response.data].sort((a, b) => a.index - b.index);

      // Token usage is reported per-batch by Voyage; distribute pro-rata
      // by character length so per-row usage logging stays meaningful.
      const totalChars = trimmed.reduce((s, t) => s + t.length, 0) || 1;
      const totalTokens = response.usage?.total_tokens ?? 0;

      return sorted.map((item, i) => ({
        vector: item.embedding,
        tokens: Math.round((trimmed[i].length / totalChars) * totalTokens),
        provider: "voyage",
        model: MODEL,
      }));
    } catch (e) {
      throw new EmbeddingError(
        `Voyage embed failed: ${(e as Error).message}`,
        "voyage",
        "PROVIDER_ERROR",
        e
      );
    }
  },
};
