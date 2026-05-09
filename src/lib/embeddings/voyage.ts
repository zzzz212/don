import {
  EmbeddingError,
  type EmbeddingInputType,
  type EmbeddingProvider,
  type EmbeddingResult,
} from "./types";

// Voyage AI — Anthropic-recommended embeddings provider with strong Russian
// quality. voyage-3-large: 1024 dim, multilingual, 32k token context.
// Free tier: 200M tokens/month for new accounts.
//
// We talk to the REST API directly via fetch() instead of the official
// `voyageai` npm SDK. The 0.2.1 SDK ships ESM with extensionless relative
// imports inside dist/esm/extended/index.mjs (../api, ../Client, ...) which
// fails Node's strict ESM resolver on Vercel:
//
//     ERR_MODULE_NOT_FOUND: Cannot find module
//     '/var/task/node_modules/voyageai/dist/esm/api'
//
// fetch is a one-line API anyway — no SDK needed.
//
// Docs: https://docs.voyageai.com/reference/embeddings-api

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = "voyage-3-large";
const DIMENSIONS = 1024;
// Voyage docs allow 32k tokens per input; ~3 chars/token in Russian.
// We cap a bit lower to leave headroom.
const MAX_INPUT_CHARS = 90_000;
// Single-batch endpoint accepts up to 1000 inputs.
const MAX_BATCH_SIZE = 128;
const REQUEST_TIMEOUT_MS = 30_000;

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
  usage?: { total_tokens?: number };
}

interface VoyageErrorResponse {
  detail?: string;
  error?: { message?: string };
}

function truncate(text: string): string {
  return text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;
}

async function callVoyageEmbed(
  apiKey: string,
  inputs: string[],
  inputType: EmbeddingInputType
): Promise<VoyageRawResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(VOYAGE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: inputs,
        model: MODEL,
        input_type: inputType,
      }),
      signal: controller.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      throw new EmbeddingError(
        `Voyage request timed out after ${REQUEST_TIMEOUT_MS}ms`,
        "voyage",
        "PROVIDER_ERROR",
        e
      );
    }
    throw new EmbeddingError(
      `Voyage network error: ${(e as Error).message}`,
      "voyage",
      "PROVIDER_ERROR",
      e
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as VoyageErrorResponse;
      detail = body.detail ?? body.error?.message ?? JSON.stringify(body);
    } catch {
      detail = await response.text().catch(() => "");
    }
    throw new EmbeddingError(
      `Voyage HTTP ${response.status}: ${detail.slice(0, 300)}`,
      "voyage",
      "PROVIDER_ERROR"
    );
  }

  return (await response.json()) as VoyageRawResponse;
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
    const apiKey = getKey();
    if (!apiKey) {
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

    const json = await callVoyageEmbed(apiKey, trimmed, inputType);

    // Voyage returns embeddings in input order with `index` field — sort by
    // it as a safety check in case the response order ever shifts.
    const sorted = [...json.data].sort((a, b) => a.index - b.index);

    // Token usage is reported per-batch; distribute pro-rata by character
    // length so per-row usage logging stays meaningful.
    const totalChars = trimmed.reduce((s, t) => s + t.length, 0) || 1;
    const totalTokens = json.usage?.total_tokens ?? 0;

    return sorted.map((item, i) => ({
      vector: item.embedding,
      tokens: Math.round((trimmed[i].length / totalChars) * totalTokens),
      provider: "voyage",
      model: MODEL,
    }));
  },
};
