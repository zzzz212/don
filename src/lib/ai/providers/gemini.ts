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
import { toGeminiSchema } from "../schema-helpers";

function getKey(): string | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "your-gemini-api-key-here") return null;
  return key;
}

export function isAvailable(): boolean {
  return getKey() !== null;
}

interface GeminiUsageRaw {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  cachedContentTokenCount?: number;
}

function toUsage(raw: GeminiUsageRaw | undefined, model: string, latencyMs: number): Usage {
  return {
    inputTokens: raw?.promptTokenCount ?? 0,
    outputTokens: raw?.candidatesTokenCount ?? 0,
    cachedInputTokens: raw?.cachedContentTokenCount ?? 0,
    provider: "gemini",
    model,
    latencyMs,
  };
}

async function getModel(modelName: string, system: string) {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(getKey()!);
  return genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: system,
  });
}

// Gemini SDK's generateContent has no built-in AbortSignal support. We
// race the request against an abort event so the caller can move on,
// even though the underlying HTTP call keeps running until the SDK
// resolves on its own. That's good enough for the cancel UX: the
// runAnalyzeJob doesn't await the orphan promise.
function withAbort<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return p;
  if (signal.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    p.then(
      (v) => {
        signal.removeEventListener("abort", onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener("abort", onAbort);
        reject(e);
      }
    );
  });
}

export async function generate<T extends z.ZodTypeAny>(
  opts: GenerateOptions<T> & { schema: T }
): Promise<GenerateResult<T>> {
  const modelName = MODEL_MAP.gemini[opts.model ?? "smart"];
  const system = normalizeSystem(opts.system);
  const start = Date.now();

  try {
    const model = await getModel(modelName, system.text);
    const result = await withAbort(
      model.generateContent({
        contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
        generationConfig: {
          temperature: opts.temperature ?? 0.1,
          maxOutputTokens: opts.maxTokens ?? 4096,
          responseMimeType: "application/json",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          responseSchema: toGeminiSchema(opts.schema) as any,
        },
      }),
      opts.signal
    );

    const text = result.response.text();
    const parsed = JSON.parse(text);
    const data = opts.schema.parse(parsed);

    return {
      data,
      usage: toUsage(result.response.usageMetadata, modelName, Date.now() - start),
    } as GenerateResult<T>;
  } catch (e) {
    throw new AIError(`Gemini generate failed: ${(e as Error).message}`, "gemini", e);
  }
}

export async function generateText(
  opts: GenerateOptions
): Promise<GenerateResult<undefined>> {
  const modelName = MODEL_MAP.gemini[opts.model ?? "smart"];
  const system = normalizeSystem(opts.system);
  const start = Date.now();

  try {
    const model = await getModel(modelName, system.text);
    const result = await withAbort(
      model.generateContent({
        contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
        generationConfig: {
          temperature: opts.temperature ?? 0.1,
          maxOutputTokens: opts.maxTokens ?? 4096,
        },
      }),
      opts.signal
    );

    return {
      data: result.response.text() as never,
      usage: toUsage(result.response.usageMetadata, modelName, Date.now() - start),
    };
  } catch (e) {
    throw new AIError(`Gemini generateText failed: ${(e as Error).message}`, "gemini", e);
  }
}

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const modelName = MODEL_MAP.gemini[opts.model ?? "smart"];
  const system = normalizeSystem(opts.system);
  const start = Date.now();

  try {
    const model = await getModel(modelName, system.text);

    const history = opts.messages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.content }],
    }));

    const lastMessage = opts.messages[opts.messages.length - 1];
    if (!lastMessage) throw new AIError("Empty messages list", "gemini");

    const chatSession = model.startChat({
      history,
      generationConfig: {
        temperature: opts.temperature ?? 0.3,
        maxOutputTokens: opts.maxTokens ?? 2048,
      },
    });

    const result = await chatSession.sendMessage(lastMessage.content);

    return {
      text: result.response.text(),
      usage: toUsage(result.response.usageMetadata, modelName, Date.now() - start),
    };
  } catch (e) {
    throw new AIError(`Gemini chat failed: ${(e as Error).message}`, "gemini", e);
  }
}

export async function* streamChat(
  opts: ChatOptions
): AsyncGenerator<StreamEvent> {
  const modelName = MODEL_MAP.gemini[opts.model ?? "smart"];
  const system = normalizeSystem(opts.system);
  const start = Date.now();

  try {
    const model = await getModel(modelName, system.text);

    const history = opts.messages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.content }],
    }));

    const lastMessage = opts.messages[opts.messages.length - 1];
    if (!lastMessage) {
      yield { kind: "error", message: "Empty messages list" };
      return;
    }

    const chatSession = model.startChat({
      history,
      generationConfig: {
        temperature: opts.temperature ?? 0.3,
        maxOutputTokens: opts.maxTokens ?? 2048,
      },
    });

    const streamResult = await chatSession.sendMessageStream(lastMessage.content);

    for await (const chunk of streamResult.stream) {
      // Check abort signal between chunks — Gemini SDK does not honor it natively.
      if (opts.signal?.aborted) {
        yield { kind: "error", message: "Stream aborted" };
        return;
      }
      const text = chunk.text();
      if (text) yield { kind: "delta", text };
    }

    const aggregated = await streamResult.response;
    yield {
      kind: "usage",
      usage: toUsage(aggregated.usageMetadata, modelName, Date.now() - start),
    };
    yield { kind: "done" };
  } catch (e) {
    yield {
      kind: "error",
      message: `Gemini stream failed: ${(e as Error).message}`,
    };
  }
}
