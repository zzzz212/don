import { z } from "zod";

type JsonSchemaObject = Record<string, unknown>;

export function toAnthropicSchema(schema: z.ZodTypeAny): JsonSchemaObject {
  const json = z.toJSONSchema(schema, { target: "draft-2020-12" }) as JsonSchemaObject;
  delete json.$schema;
  return json;
}

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
    if (!GEMINI_ALLOWED_KEYS.has(key)) continue;

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
