import type { z } from "zod";
import {
  AIError,
  type AIProvider,
  type ChatOptions,
  type ChatResult,
  type GenerateOptions,
  type GenerateResult,
} from "./types";
import * as anthropic from "./providers/anthropic";
import * as gemini from "./providers/gemini";
import * as groq from "./providers/groq";

// ── Provider selection ──────────────────────────────────────────────

const PROVIDER_PRIORITY: Exclude<AIProvider, "demo">[] = [
  "anthropic",
  "gemini",
  "groq",
];

const PROVIDERS = {
  anthropic,
  gemini,
  groq,
};

export function getActiveProvider(): AIProvider {
  for (const p of PROVIDER_PRIORITY) {
    if (PROVIDERS[p].isAvailable()) return p;
  }
  return "demo";
}

function getAvailableProviders(): Exclude<AIProvider, "demo">[] {
  return PROVIDER_PRIORITY.filter((p) => PROVIDERS[p].isAvailable());
}

// ── Public API ──────────────────────────────────────────────────────

export async function generate<T extends z.ZodTypeAny>(
  opts: GenerateOptions<T> & { schema: T }
): Promise<GenerateResult<T>> {
  const providers = getAvailableProviders();
  if (providers.length === 0) {
    throw new AIError("No AI provider configured", "demo");
  }

  let lastError: unknown;
  for (const p of providers) {
    try {
      return await PROVIDERS[p].generate(opts);
    } catch (e) {
      lastError = e;
      console.error(`[ai] Provider ${p} failed, trying next:`, (e as Error).message);
    }
  }

  throw new AIError(
    `All providers failed. Last: ${(lastError as Error)?.message}`,
    providers[providers.length - 1],
    lastError
  );
}

export async function generateText(
  opts: GenerateOptions
): Promise<GenerateResult<undefined>> {
  const providers = getAvailableProviders();
  if (providers.length === 0) {
    throw new AIError("No AI provider configured", "demo");
  }

  let lastError: unknown;
  for (const p of providers) {
    try {
      return await PROVIDERS[p].generateText(opts);
    } catch (e) {
      lastError = e;
      console.error(`[ai] Provider ${p} failed, trying next:`, (e as Error).message);
    }
  }

  throw new AIError(
    `All providers failed. Last: ${(lastError as Error)?.message}`,
    providers[providers.length - 1],
    lastError
  );
}

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const providers = getAvailableProviders();
  if (providers.length === 0) {
    throw new AIError("No AI provider configured", "demo");
  }

  let lastError: unknown;
  for (const p of providers) {
    try {
      return await PROVIDERS[p].chat(opts);
    } catch (e) {
      lastError = e;
      console.error(`[ai] Provider ${p} failed, trying next:`, (e as Error).message);
    }
  }

  throw new AIError(
    `All providers failed. Last: ${(lastError as Error)?.message}`,
    providers[providers.length - 1],
    lastError
  );
}

// ── Re-exports ──────────────────────────────────────────────────────

export type { AIProvider, ChatOptions, GenerateOptions, GenerateResult, Usage } from "./types";
export { AIError } from "./types";

// ── Backward-compatibility shims ────────────────────────────────────
// Old code calls generateAI / chatAI with positional args. Keep both working
// until consumers are migrated; they simply delegate to the new API.

export interface LegacyAIMessage {
  role: "user" | "assistant" | "model" | "system";
  content: string;
}

export interface LegacyAIResponse {
  text: string;
  provider: AIProvider;
}

export async function generateAI(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 4096,
  temperature = 0.1
): Promise<LegacyAIResponse> {
  const result = await generateText({
    system: systemPrompt,
    prompt: userMessage,
    maxTokens,
    temperature,
  });
  return { text: result.data, provider: result.usage.provider };
}

export async function chatAI(
  systemPrompt: string,
  messages: LegacyAIMessage[],
  maxTokens = 2048
): Promise<LegacyAIResponse> {
  const normalized = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "model" ? ("assistant" as const) : (m.role as "user" | "assistant"),
      content: m.content,
    }));

  const result = await chat({
    system: systemPrompt,
    messages: normalized,
    maxTokens,
  });
  return { text: result.text, provider: result.usage.provider };
}
