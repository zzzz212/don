import { GoogleGenerativeAI } from "@google/generative-ai";

function getGeminiKey(): string | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "your-gemini-api-key-here") return null;
  return key;
}

function getAnthropicKey(): string | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === "your-api-key-here") return null;
  return key;
}

export type AIProvider = "gemini" | "anthropic" | "demo";

export function getActiveProvider(): AIProvider {
  if (getGeminiKey()) return "gemini";
  if (getAnthropicKey()) return "anthropic";
  return "demo";
}

export interface AIMessage {
  role: "user" | "assistant" | "model";
  content: string;
}

export interface AIResponse {
  text: string;
  provider: AIProvider;
}

/**
 * Send a single prompt with a system instruction and get a response.
 */
export async function generateAI(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 4096
): Promise<AIResponse> {
  const provider = getActiveProvider();

  if (provider === "gemini") {
    return generateGemini(systemPrompt, userMessage, maxTokens);
  }

  if (provider === "anthropic") {
    return generateAnthropic(systemPrompt, userMessage, maxTokens);
  }

  throw new Error("No AI provider configured");
}

/**
 * Multi-turn chat with system instruction.
 */
export async function chatAI(
  systemPrompt: string,
  messages: AIMessage[],
  maxTokens = 2048
): Promise<AIResponse> {
  const provider = getActiveProvider();

  if (provider === "gemini") {
    return chatGemini(systemPrompt, messages, maxTokens);
  }

  if (provider === "anthropic") {
    return chatAnthropic(systemPrompt, messages, maxTokens);
  }

  throw new Error("No AI provider configured");
}

// ── Gemini ──────────────────────────────────────────────

async function generateGemini(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<AIResponse> {
  const genAI = new GoogleGenerativeAI(getGeminiKey()!);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: systemPrompt,
    generationConfig: { maxOutputTokens: maxTokens },
  });

  const result = await model.generateContent(userMessage);
  const text = result.response.text();

  return { text, provider: "gemini" };
}

async function chatGemini(
  systemPrompt: string,
  messages: AIMessage[],
  maxTokens: number
): Promise<AIResponse> {
  const genAI = new GoogleGenerativeAI(getGeminiKey()!);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: systemPrompt,
    generationConfig: { maxOutputTokens: maxTokens },
  });

  // Convert messages to Gemini format
  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({ history });
  const lastMessage = messages[messages.length - 1];
  const result = await chat.sendMessage(lastMessage.content);
  const text = result.response.text();

  return { text, provider: "gemini" };
}

// ── Anthropic ───────────────────────────────────────────

async function generateAnthropic(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<AIResponse> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic();

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  return { text, provider: "anthropic" };
}

async function chatAnthropic(
  systemPrompt: string,
  messages: AIMessage[],
  maxTokens: number
): Promise<AIResponse> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic();

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role === "model" ? ("assistant" as const) : (m.role as "user" | "assistant"),
      content: m.content,
    })),
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  return { text, provider: "anthropic" };
}
