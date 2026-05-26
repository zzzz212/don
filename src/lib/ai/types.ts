import type { z } from "zod";

export type AIProvider = "anthropic" | "gemini" | "groq" | "demo";

export type ModelTier = "fast" | "smart" | "deep";

export interface SystemPrompt {
  text: string;
  cacheable?: boolean;
}

export type SystemPromptInput = SystemPrompt | string;

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  provider: AIProvider;
  model: string;
  latencyMs: number;
}

export interface ChatMessageInput {
  role: "user" | "assistant";
  content: string;
}

export interface GenerateOptions<T extends z.ZodTypeAny = z.ZodTypeAny> {
  schema?: T;
  prompt: string;
  system: SystemPromptInput;
  model?: ModelTier;
  temperature?: number;
  maxTokens?: number;
  /** Optional abort signal — when fired, the upstream AI request is cancelled. */
  signal?: AbortSignal;
}

export interface ChatOptions {
  messages: ChatMessageInput[];
  system: SystemPromptInput;
  model?: ModelTier;
  temperature?: number;
  maxTokens?: number;
  /** Optional abort signal — when fired, the upstream AI request is cancelled. */
  signal?: AbortSignal;
}

/**
 * Single event in a streaming chat response. Providers yield zero or more
 * `delta` events, then one `usage` event, then `done`. `error` may appear
 * at any point and terminates the stream.
 *
 * `saved` is emitted by route handlers (not providers) after the stream
 * completes and the result is persisted somewhere — e.g. /api/generated/
 * [id]/refine fires it after committing the new DocumentVersion so the
 * client can navigate / show the new version number without an extra
 * fetch round-trip.
 */
export type StreamEvent =
  | { kind: "delta"; text: string }
  | { kind: "usage"; usage: Usage }
  | { kind: "error"; message: string }
  | { kind: "done" }
  | { kind: "saved"; payload: Record<string, unknown> }
  // Lifecycle hint emitted by the refine route so the UI can switch
  // between "applying patches" and "streaming a regenerated document"
  // states without guessing from the absence of delta events.
  | { kind: "mode"; mode: "patch" | "regen"; reason?: string };

export type GenerateResult<T extends z.ZodTypeAny | undefined> = {
  data: T extends z.ZodTypeAny ? z.infer<T> : string;
  usage: Usage;
};

export interface ChatResult {
  text: string;
  usage: Usage;
}

export class AIError extends Error {
  constructor(
    message: string,
    public readonly provider: AIProvider,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "AIError";
  }
}

export const MODEL_MAP: Record<Exclude<AIProvider, "demo">, Record<ModelTier, string>> = {
  anthropic: {
    fast: "claude-haiku-4-5-20251001",
    smart: "claude-sonnet-4-6",
    deep: "claude-opus-4-7",
  },
  gemini: {
    fast: "gemini-2.5-flash",
    smart: "gemini-2.5-flash",
    deep: "gemini-2.5-pro",
  },
  groq: {
    fast: "llama-3.3-70b-versatile",
    smart: "llama-3.3-70b-versatile",
    deep: "llama-3.3-70b-versatile",
  },
};

export function normalizeSystem(s: SystemPromptInput): SystemPrompt {
  return typeof s === "string" ? { text: s, cacheable: false } : s;
}
