import { describe, it, expect } from "vitest";
import { z } from "zod";
import { toGeminiSchema, toAnthropicSchema } from "../schema-helpers";
import { AnalysisResultSchema } from "../schemas/analyze";
import { ChunkRisksSchema, SynthesisSchema } from "../schemas/chunk";
import { RefinePatchSchema } from "../schemas/refine-patch";

// Walk a JSON-schema object by key path, asserting each hop is an object.
// Keeps the tests readable without scattering `as` casts (or `any`).
function get(node: unknown, ...path: string[]): unknown {
  let cur: unknown = node;
  for (const key of path) {
    expect(
      cur !== null && typeof cur === "object",
      `path "${path.join(".")}" broke at "${key}"`
    ).toBe(true);
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

describe("toGeminiSchema — production schemas (the Gemini fallback path)", () => {
  it("converts the analyze schema without refs and keeps nested structure", () => {
    const s = toGeminiSchema(AnalysisResultSchema);
    const json = JSON.stringify(s);

    // Gemini's responseSchema rejects $ref / $defs — Zod must inline.
    expect(json).not.toContain("$ref");
    expect(json).not.toContain("$defs");
    expect(json).not.toContain("$schema");
    expect(get(s, "type")).toBe("object");

    // Numeric bounds survive.
    expect(get(s, "properties", "score", "type")).toBe("integer");
    expect(get(s, "properties", "score", "minimum")).toBe(1);
    expect(get(s, "properties", "score", "maximum")).toBe(10);

    // Enums survive.
    expect(get(s, "properties", "verdict", "enum")).toEqual([
      "sign",
      "negotiate",
      "do_not_sign",
    ]);

    // A nested array-of-objects survives intact down to its leaves.
    expect(get(s, "properties", "risks", "items", "properties", "clauseNumber", "type")).toBe(
      "string"
    );
    expect(
      get(s, "properties", "risks", "items", "properties", "level", "enum")
    ).toEqual(["critical", "medium", "low"]);
  });

  it("keeps an optional field as a property but out of `required`", () => {
    const s = toGeminiSchema(SynthesisSchema);
    // `balance` is .optional() — present in properties, absent from required.
    expect(get(s, "properties", "balance")).toBeDefined();
    expect(get(s, "required")).not.toContain("balance");
    expect(get(s, "required")).toContain("verdict");
  });

  it("converts the chunk-risks schema", () => {
    const s = toGeminiSchema(ChunkRisksSchema);
    expect(
      get(s, "properties", "risks", "items", "properties", "clauseNumber", "type")
    ).toBe("string");
  });
});

describe("toGeminiSchema — discriminated unions", () => {
  it("translates a `oneOf` union into `anyOf` instead of dropping it", () => {
    // Regression: cleanForGemini used to strip `oneOf`, collapsing
    // `items` to `{}` — "an array of anything". Gemini then returned
    // garbage that failed the Zod re-parse, with no hint as to why.
    const s = toGeminiSchema(RefinePatchSchema);
    const branches = get(s, "properties", "operations", "items", "anyOf");
    expect(Array.isArray(branches)).toBe(true);
    expect(branches as unknown[]).toHaveLength(4);

    // Every branch keeps its object structure — none collapsed to `{}`.
    for (const branch of branches as unknown[]) {
      expect(get(branch, "type")).toBe("object");
      expect(Object.keys(get(branch, "properties") as object).length).toBeGreaterThan(0);
    }
  });

  it("turns a literal `const` discriminator into a single-member enum", () => {
    const s = toGeminiSchema(RefinePatchSchema);
    const branches = get(s, "properties", "operations", "items", "anyOf") as unknown[];
    const discriminators = branches.map((b) => get(b, "properties", "op", "enum"));
    expect(discriminators).toEqual([
      ["replace"],
      ["insert_after"],
      ["insert_before"],
      ["delete"],
    ]);
    // Gemini has no `const` — it must be gone entirely.
    expect(JSON.stringify(s)).not.toContain('"const"');
  });
});

describe("toGeminiSchema — unsupported keywords", () => {
  it("throws (rather than silently dropping) an unrepresentable keyword", () => {
    // z.tuple emits `prefixItems`, which Gemini cannot express. A throw
    // lets the AI client fall through to the next provider with a clear
    // reason instead of sending a schema that means something different.
    const tupleSchema = z.object({ pair: z.tuple([z.string(), z.number()]) });
    expect(() => toGeminiSchema(tupleSchema)).toThrow(
      /unsupported JSON Schema keyword/
    );
  });
});

describe("toAnthropicSchema", () => {
  it("strips $schema but keeps the rest of the structure", () => {
    const s = toAnthropicSchema(AnalysisResultSchema);
    expect(get(s, "$schema")).toBeUndefined();
    expect(get(s, "type")).toBe("object");
    expect(get(s, "properties", "verdict", "enum")).toEqual([
      "sign",
      "negotiate",
      "do_not_sign",
    ]);
  });
});
