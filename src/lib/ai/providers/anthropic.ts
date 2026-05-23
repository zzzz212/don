import type { z } from "zod";
import {
  AIError,
  type ChatOptions,
  type ChatResult,
  type GenerateOptions,
  type GenerateResult,
  type StreamEvent,
  type Usage,
  MODEL_MAP,
  normalizeSystem,
} from "../types";
import { toAnthropicSchema } from "../schema-helpers";

// Tool name and description matter for Anthropic's tool_use schema
// parsing. The earlier name `submit_result` + description "Submit the
// structured result" caused claude-opus-4-7 to wrap the entire payload
// under `{ result: {...} }`, treating the schema as describing "the
// result object" rather than the top-level shape. Neutral verb-noun
// naming with explicit "fields directly" wording avoids that.
const TOOL_NAME = "record_response";

// True when the model wrapped its tool_use payload under a single
// `{ "result": {...} }` key — observed on claude-opus-4-7 with the old
// `submit_result` tool name. Still defended against because models
// can regress and this is cheap to keep.
function isResultWrapper(input: unknown): input is { result: object } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const keys = Object.keys(input);
  if (keys.length !== 1 || keys[0] !== "result") return false;
  const inner = (input as { result: unknown }).result;
  return inner !== null && typeof inner === "object" && !Array.isArray(inner);
}

function getKey(): string | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === "your-api-key-here") return null;
  return key;
}

export function isAvailable(): boolean {
  return getKey() !== null;
}

async function getClient() {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  return new Anthropic({ apiKey: getKey()! });
}

interface AnthropicUsageRaw {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

function toUsage(raw: AnthropicUsageRaw, model: string, latencyMs: number): Usage {
  return {
    inputTokens: raw.input_tokens,
    outputTokens: raw.output_tokens,
    cachedInputTokens: raw.cache_read_input_tokens ?? 0,
    provider: "anthropic",
    model,
    latencyMs,
  };
}

export async function generate<T extends z.ZodTypeAny>(
  opts: GenerateOptions<T> & { schema: T }
): Promise<GenerateResult<T>> {
  const model = MODEL_MAP.anthropic[opts.model ?? "smart"];
  const system = normalizeSystem(opts.system);
  const client = await getClient();
  const start = Date.now();

  // Cache breakpoint on the tool definition too — tool_use schemas can
  // be 500-1000 tokens for our analyze/synthesis paths, and the JSON
  // schema is stable across every request that uses the same Zod type.
  // Anthropic counts the cumulative prefix (system + tools) toward the
  // 1024-token minimum, so this also rescues short-system requests.
  const tool = {
    name: TOOL_NAME,
    description:
      "Provide the response fields described in input_schema as direct top-level properties. Do NOT nest them under any wrapper key. Call this tool exactly once.",
    input_schema: toAnthropicSchema(opts.schema) as never,
    ...(system.cacheable
      ? { cache_control: { type: "ephemeral" as const } }
      : {}),
  };

  const systemBlocks = system.cacheable
    ? [{ type: "text" as const, text: system.text, cache_control: { type: "ephemeral" as const } }]
    : system.text;

  try {
    const response = await client.messages.create({
      model,
      max_tokens: opts.maxTokens ?? 4096,
      // Anthropic's current models reject an explicit `temperature`
      // (400 invalid_request_error) — omit it; the model default applies.
      system: systemBlocks,
      tools: [tool],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [{ role: "user", content: opts.prompt }],
    });

    const block = response.content.find((c) => c.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      // Diagnostic: log what content blocks DID come back when the
      // expected tool_use is missing — model may be returning text
      // refusal or stop_reason mismatch.
      console.error("[anthropic] no tool_use block. Response content types:", {
        types: response.content.map((c) => c.type),
        stop_reason: response.stop_reason,
        stop_sequence: response.stop_sequence,
      });
      throw new AIError("No tool_use block in Anthropic response", "anthropic");
    }

    // Some Anthropic models (observed on claude-opus-4-7 in prod 2026-05-24)
    // wrap the tool_use payload under a single `{ "result": {...} }` key,
    // treating the schema as describing "the result object" rather than
    // the top-level shape. Detect that exact pattern and unwrap — both
    // shapes lose nothing because our schema never has a top-level
    // `result` property (search src/lib/ai/schemas/ — none do).
    let rawInput: unknown = block.input;
    if (isResultWrapper(rawInput)) {
      rawInput = (rawInput as { result: unknown }).result;
    }

    // Diagnostic: log the raw tool_use.input so we can see what the
    // model actually wrote when zod parsing fails downstream. Remove
    // once the empty-response root cause is pinned (Sprint 14 incident
    // 2026-05-24).
    if (process.env.DEBUG_ANTHROPIC_TOOL_USE !== "off") {
      const inputStr = JSON.stringify(block.input);
      console.error("[anthropic] tool_use.input:", {
        model,
        stop_reason: response.stop_reason,
        input_keys: block.input && typeof block.input === "object"
          ? Object.keys(block.input as object)
          : null,
        unwrapped: rawInput !== block.input,
        input_length: inputStr.length,
        input_preview: inputStr.slice(0, 800),
        usage: response.usage,
      });
    }

    const data = opts.schema.parse(rawInput);
    return {
      data,
      usage: toUsage(response.usage, model, Date.now() - start),
    } as GenerateResult<T>;
  } catch (e) {
    if (e instanceof AIError) throw e;
    throw new AIError(
      `Anthropic generate failed: ${(e as Error).message}`,
      "anthropic",
      e
    );
  }
}

export async function generateText(
  opts: GenerateOptions
): Promise<GenerateResult<undefined>> {
  const model = MODEL_MAP.anthropic[opts.model ?? "smart"];
  const system = normalizeSystem(opts.system);
  const client = await getClient();
  const start = Date.now();

  const systemBlocks = system.cacheable
    ? [{ type: "text" as const, text: system.text, cache_control: { type: "ephemeral" as const } }]
    : system.text;

  try {
    const response = await client.messages.create({
      model,
      max_tokens: opts.maxTokens ?? 4096,
      // temperature omitted — rejected by Anthropic's current models.
      system: systemBlocks,
      messages: [{ role: "user", content: opts.prompt }],
    });

    const text = response.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { text: string }).text)
      .join("");

    return {
      data: text as never,
      usage: toUsage(response.usage, model, Date.now() - start),
    };
  } catch (e) {
    throw new AIError(
      `Anthropic generateText failed: ${(e as Error).message}`,
      "anthropic",
      e
    );
  }
}

// Convert a flat ChatOptions message array into Anthropic's structured
// content shape, dropping a cache_control marker on the LAST message in
// the conversation history (everything before the user's current turn).
// This makes long-running conversations cheap on input: each follow-up
// re-uses the prefix as a cache hit instead of re-billing the entire
// thread.
//
// Why "second-to-last": the current user turn changes every request,
// so the cache key has to end one turn earlier. The marker stays on
// the prefix that's stable across the next call too.
function buildCachedMessages(
  messages: ChatOptions["messages"]
): Array<{
  role: "user" | "assistant";
  content:
    | string
    | Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }>;
}> {
  if (messages.length < 2) {
    return messages.map((m) => ({ role: m.role, content: m.content }));
  }
  const lastPrefixIdx = messages.length - 2;
  return messages.map((m, i) => {
    if (i === lastPrefixIdx) {
      return {
        role: m.role,
        content: [
          {
            type: "text" as const,
            text: m.content,
            cache_control: { type: "ephemeral" as const },
          },
        ],
      };
    }
    return { role: m.role, content: m.content };
  });
}

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const model = MODEL_MAP.anthropic[opts.model ?? "smart"];
  const system = normalizeSystem(opts.system);
  const client = await getClient();
  const start = Date.now();

  const systemBlocks = system.cacheable
    ? [{ type: "text" as const, text: system.text, cache_control: { type: "ephemeral" as const } }]
    : system.text;

  try {
    const response = await client.messages.create({
      model,
      max_tokens: opts.maxTokens ?? 2048,
      // temperature omitted — rejected by Anthropic's current models.
      system: systemBlocks,
      messages: buildCachedMessages(opts.messages),
    });

    const text = response.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { text: string }).text)
      .join("");

    return {
      text,
      usage: toUsage(response.usage, model, Date.now() - start),
    };
  } catch (e) {
    throw new AIError(`Anthropic chat failed: ${(e as Error).message}`, "anthropic", e);
  }
}

export async function* streamChat(
  opts: ChatOptions
): AsyncGenerator<StreamEvent> {
  const model = MODEL_MAP.anthropic[opts.model ?? "smart"];
  const system = normalizeSystem(opts.system);
  const client = await getClient();
  const start = Date.now();

  const systemBlocks = system.cacheable
    ? [{ type: "text" as const, text: system.text, cache_control: { type: "ephemeral" as const } }]
    : system.text;

  try {
    const stream = client.messages.stream(
      {
        model,
        max_tokens: opts.maxTokens ?? 2048,
        // temperature omitted — rejected by Anthropic's current models.
        system: systemBlocks,
        messages: buildCachedMessages(opts.messages),
      },
      { signal: opts.signal }
    );

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield { kind: "delta", text: event.delta.text };
      }
    }

    const finalMessage = await stream.finalMessage();
    yield {
      kind: "usage",
      usage: toUsage(finalMessage.usage, model, Date.now() - start),
    };
    yield { kind: "done" };
  } catch (e) {
    yield {
      kind: "error",
      message: `Anthropic stream failed: ${(e as Error).message}`,
    };
  }
}
