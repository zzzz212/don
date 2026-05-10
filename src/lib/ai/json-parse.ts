// Pure JSON helpers used by providers that return stringified JSON instead of
// structured tool-use payloads (currently: Groq).

import type { z } from "zod";

/**
 * Strip ```json fenced code blocks if the model returned them despite being
 * asked for raw JSON. Returns the payload trimmed of whitespace either way.
 */
export function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

/**
 * Parse a JSON string against a zod schema. Returns the parsed object on
 * success, or null on either JSON parse failure or schema mismatch — the
 * provider then knows to retry with a stricter prompt.
 */
export function tryParse<T extends z.ZodTypeAny>(
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
