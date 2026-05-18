import { z } from "zod";

type JsonSchemaObject = Record<string, unknown>;

export function toAnthropicSchema(schema: z.ZodTypeAny): JsonSchemaObject {
  const json = z.toJSONSchema(schema, { target: "draft-2020-12" }) as JsonSchemaObject;
  delete json.$schema;
  return json;
}

// JSON Schema keywords Gemini's responseSchema understands. Everything
// listed here is copied through verbatim or recursed into.
const GEMINI_ALLOWED_KEYS = new Set([
  "type",
  "format",
  "description",
  "nullable",
  "enum",
  "properties",
  "required",
  "items",
  "minimum",
  "maximum",
  "minItems",
  "maxItems",
  "minLength",
  "maxLength",
]);

// Keywords that carry no meaning for Gemini's responseSchema — dropping
// them does not change what the schema describes, so it is done silently.
const GEMINI_DROPPABLE_KEYS = new Set([
  "$schema",
  "$id",
  "$anchor",
  "$comment",
  "additionalProperties",
  "default",
  "title",
  "examples",
]);

/**
 * Convert a Zod schema into a Gemini-compatible `responseSchema`.
 *
 * Gemini accepts only a subset of JSON Schema. The earlier version of
 * this converter silently dropped every key it didn't recognise — which
 * quietly destroyed discriminated unions: `oneOf` vanished and `items`
 * collapsed to `{}` ("an array of anything"). Gemini then returned data
 * that failed the Zod re-parse with no hint why.
 *
 * Now `oneOf`/`anyOf` translate to Gemini's `anyOf`, a single-value
 * `const` becomes a one-member `enum` (so discriminators survive),
 * genuinely meaningless keywords are dropped, and anything else unknown
 * THROWS. A throw is caught by the AI client's fallback chain, which
 * moves on to the next provider with a clear reason — far better than
 * sending Gemini a structurally-empty schema.
 */
export function toGeminiSchema(schema: z.ZodTypeAny): JsonSchemaObject {
  const json = z.toJSONSchema(schema, { target: "draft-2020-12" }) as JsonSchemaObject;
  return cleanForGemini(json);
}

function cleanForGemini(node: unknown): JsonSchemaObject {
  if (node === null || typeof node !== "object" || Array.isArray(node)) {
    return node as JsonSchemaObject;
  }

  const obj = node as JsonSchemaObject;
  const out: JsonSchemaObject = {};

  for (const [key, value] of Object.entries(obj)) {
    if (GEMINI_DROPPABLE_KEYS.has(key)) continue;

    // Gemini has no `const`; a single-member `enum` is equivalent — this
    // is how a discriminated-union discriminator survives the conversion.
    if (key === "const") {
      out.enum = [value];
      continue;
    }

    // Zod emits a discriminated union as `oneOf`; Gemini expresses unions
    // as `anyOf`. The discriminator keeps the branches mutually exclusive,
    // so `anyOf` is a faithful representation here.
    if (key === "oneOf" || key === "anyOf") {
      out.anyOf = Array.isArray(value)
        ? value.map((member) => cleanForGemini(member))
        : value;
      continue;
    }

    if (!GEMINI_ALLOWED_KEYS.has(key)) {
      throw new Error(
        `toGeminiSchema: unsupported JSON Schema keyword "${key}" — ` +
          `cannot be represented in a Gemini responseSchema without ` +
          `changing its meaning`
      );
    }

    if (key === "properties" && value && typeof value === "object") {
      const props: JsonSchemaObject = {};
      for (const [propName, propSchema] of Object.entries(value)) {
        props[propName] = cleanForGemini(propSchema);
      }
      out.properties = props;
    } else if (key === "items") {
      out.items = cleanForGemini(value);
    } else {
      out[key] = value;
    }
  }

  return out;
}

export function describeSchemaForPrompt(schema: z.ZodTypeAny): string {
  const json = toAnthropicSchema(schema);
  return JSON.stringify(json, null, 2);
}
