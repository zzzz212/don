import type { z } from "zod";
import {
  AIError,
  type AIProvider,
  type ChatOptions,
  type ChatResult,
  type GenerateOptions,
  type GenerateResult,
  type StreamEvent,
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

// One-time diagnostic when the module first loads — shows in Vercel
// function logs whether each provider's env var was actually picked up
// at runtime. If you expect Anthropic but Groq is winning, this is the
// first thing to check.
if (typeof process !== "undefined" && process.env.NODE_ENV !== "test") {
  const seen = PROVIDER_PRIORITY.map((p) => `${p}=${PROVIDERS[p].isAvailable() ? "✓" : "✗"}`).join(" ");
  console.info(`[ai/client] providers available at boot: ${seen}`);
}

// ── Public API ──────────────────────────────────────────────────────

// Helper: collect per-provider failure reasons into one consolidated
// error message so the eventual thrown AIError lists every step of the
// fallback chain, not just the last one. Big win for debugging — a
// single line in the route's saveError / Sentry payload tells you
// "anthropic 401, gemini missing key, groq 413" instead of just the
// final 413.
function summariseFailures(
  failures: Array<{ provider: string; message: string }>
): string {
  return failures
    .map((f) => `${f.provider}: ${f.message.slice(0, 200)}`)
    .join(" | ");
}

export async function generate<T extends z.ZodTypeAny>(
  opts: GenerateOptions<T> & { schema: T }
): Promise<GenerateResult<T>> {
  const providers = getAvailableProviders();
  if (providers.length === 0) {
    throw new AIError("No AI provider configured", "demo");
  }

  const failures: Array<{ provider: string; message: string }> = [];
  let lastError: unknown;
  for (const p of providers) {
    try {
      return await PROVIDERS[p].generate(opts);
    } catch (e) {
      lastError = e;
      const message = (e as Error).message ?? "unknown";
      failures.push({ provider: p, message });
      console.error(`[ai] Provider ${p} failed, trying next:`, message);
    }
  }

  throw new AIError(
    `All providers failed: ${summariseFailures(failures)}`,
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

  const failures: Array<{ provider: string; message: string }> = [];
  let lastError: unknown;
  for (const p of providers) {
    try {
      return await PROVIDERS[p].generateText(opts);
    } catch (e) {
      lastError = e;
      const message = (e as Error).message ?? "unknown";
      failures.push({ provider: p, message });
      console.error(`[ai] Provider ${p} failed, trying next:`, message);
    }
  }

  throw new AIError(
    `All providers failed: ${summariseFailures(failures)}`,
    providers[providers.length - 1],
    lastError
  );
}

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const providers = getAvailableProviders();
  if (providers.length === 0) {
    throw new AIError("No AI provider configured", "demo");
  }

  const failures: Array<{ provider: string; message: string }> = [];
  let lastError: unknown;
  for (const p of providers) {
    try {
      return await PROVIDERS[p].chat(opts);
    } catch (e) {
      lastError = e;
      const message = (e as Error).message ?? "unknown";
      failures.push({ provider: p, message });
      console.error(`[ai] Provider ${p} failed, trying next:`, message);
    }
  }

  throw new AIError(
    `All providers failed: ${summariseFailures(failures)}`,
    providers[providers.length - 1],
    lastError
  );
}

/**
 * Streaming chat — yields delta / usage / done / error events from the
 * highest-priority available provider. There is no mid-stream fallback:
 * once any delta has been emitted we are committed to that provider.
 * Falling back would require restarting the message on the consumer side,
 * which is worse UX than failing fast.
 */
export async function* streamChat(
  opts: ChatOptions
): AsyncGenerator<StreamEvent> {
  const providers = getAvailableProviders();
  if (providers.length === 0) {
    yield { kind: "error", message: "No AI provider configured" };
    return;
  }
  yield* PROVIDERS[providers[0]].streamChat(opts);
}

// ── Re-exports ──────────────────────────────────────────────────────

export type {
  AIProvider,
  ChatOptions,
  GenerateOptions,
  GenerateResult,
  StreamEvent,
  Usage,
} from "./types";
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
