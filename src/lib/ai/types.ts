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
 */
export type StreamEvent =
  | { kind: "delta"; text: string }
  | { kind: "usage"; usage: Usage }
  | { kind: "error"; message: string }
  | { kind: "done" };

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
