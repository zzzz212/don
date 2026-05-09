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

const TOOL_NAME = "submit_result";

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

  const tool = {
    name: TOOL_NAME,
    description: "Submit the structured result. You MUST call this tool exactly once.",
    input_schema: toAnthropicSchema(opts.schema) as never,
  };

  const systemBlocks = system.cacheable
    ? [{ type: "text" as const, text: system.text, cache_control: { type: "ephemeral" as const } }]
    : system.text;

  try {
    const response = await client.messages.create({
      model,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.1,
      system: systemBlocks,
      tools: [tool],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [{ role: "user", content: opts.prompt }],
    });

    const block = response.content.find((c) => c.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      throw new AIError("No tool_use block in Anthropic response", "anthropic");
    }

    const data = opts.schema.parse(block.input);
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
      temperature: opts.temperature ?? 0.1,
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
      temperature: opts.temperature ?? 0.3,
      system: systemBlocks,
      messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
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
        temperature: opts.temperature ?? 0.3,
        system: systemBlocks,
        messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
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
