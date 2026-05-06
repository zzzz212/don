import type { z } from "zod";
import {
  AIError,
  type ChatOptions,
  type ChatResult,
  type GenerateOptions,
  type GenerateResult,
  type Usage,
  MODEL_MAP,
  normalizeSystem,
} from "../types";
import { describeSchemaForPrompt } from "../schema-helpers";

function getKey(): string | null {
  const key = process.env.GROQ_API_KEY;
  if (!key || key === "your-groq-api-key-here") return null;
  return key;
}

export function isAvailable(): boolean {
  return getKey() !== null;
}

interface GroqUsageRaw {
  prompt_tokens?: number;
  completion_tokens?: number;
}

function toUsage(raw: GroqUsageRaw | undefined, model: string, latencyMs: number): Usage {
  return {
    inputTokens: raw?.prompt_tokens ?? 0,
    outputTokens: raw?.completion_tokens ?? 0,
    cachedInputTokens: 0,
    provider: "groq",
    model,
    latencyMs,
  };
}

async function getClient() {
  const Groq = (await import("groq-sdk")).default;
  return new Groq({ apiKey: getKey()! });
}

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function tryParse<T extends z.ZodTypeAny>(
  raw: string,
  schema: T
): z.infer<T> | null {
  try {
    const parsed = JSON.parse(stripJsonFences(raw));
    return schema.parse(parsed);
  } catch {
    return null;
  }
}

export async function generate<T extends z.ZodTypeAny>(
  opts: GenerateOptions<T> & { schema: T }
): Promise<GenerateResult<T>> {
  const modelName = MODEL_MAP.groq[opts.model ?? "smart"];
  const system = normalizeSystem(opts.system);
  const client = await getClient();
  const start = Date.now();

  const schemaHint = `\n\nОТВЕЧАЙ строго JSON-объектом, соответствующим схеме:\n${describeSchemaForPrompt(opts.schema)}`;
  const systemWithSchema = system.text + schemaHint;

  try {
    const response = await client.chat.completions.create({
      model: modelName,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemWithSchema },
        { role: "user", content: opts.prompt },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    let data = tryParse(text, opts.schema);

    if (data === null) {
      // One retry with stricter instruction
      const retryResponse = await client.chat.completions.create({
        model: modelName,
        max_tokens: opts.maxTokens ?? 4096,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemWithSchema },
          { role: "user", content: opts.prompt },
          { role: "assistant", content: text },
          {
            role: "user",
            content:
              "Предыдущий ответ не соответствует схеме. Выведи ТОЛЬКО валидный JSON по указанной схеме без markdown.",
          },
        ],
      });

      const retryText = retryResponse.choices[0]?.message?.content ?? "";
      data = tryParse(retryText, opts.schema);

      if (data === null) {
        throw new AIError("Groq returned invalid JSON after retry", "groq");
      }

      return {
        data,
        usage: toUsage(retryResponse.usage, modelName, Date.now() - start),
      } as GenerateResult<T>;
    }

    return {
      data,
      usage: toUsage(response.usage, modelName, Date.now() - start),
    } as GenerateResult<T>;
  } catch (e) {
    if (e instanceof AIError) throw e;
    throw new AIError(`Groq generate failed: ${(e as Error).message}`, "groq", e);
  }
}

export async function generateText(
  opts: GenerateOptions
): Promise<GenerateResult<undefined>> {
  const modelName = MODEL_MAP.groq[opts.model ?? "smart"];
  const system = normalizeSystem(opts.system);
  const client = await getClient();
  const start = Date.now();

  try {
    const response = await client.chat.completions.create({
      model: modelName,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.1,
      messages: [
        { role: "system", content: system.text },
        { role: "user", content: opts.prompt },
      ],
    });

    return {
      data: (response.choices[0]?.message?.content ?? "") as never,
      usage: toUsage(response.usage, modelName, Date.now() - start),
    };
  } catch (e) {
    throw new AIError(`Groq generateText failed: ${(e as Error).message}`, "groq", e);
  }
}

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const modelName = MODEL_MAP.groq[opts.model ?? "smart"];
  const system = normalizeSystem(opts.system);
  const client = await getClient();
  const start = Date.now();

  try {
    const response = await client.chat.completions.create({
      model: modelName,
      max_tokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.3,
      messages: [
        { role: "system", content: system.text },
        ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });

    return {
      text: response.choices[0]?.message?.content ?? "",
      usage: toUsage(response.usage, modelName, Date.now() - start),
    };
  } catch (e) {
    throw new AIError(`Groq chat failed: ${(e as Error).message}`, "groq", e);
  }
}
