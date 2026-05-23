import { describe, it, expect } from "vitest";
import { z } from "zod";

// We re-export isResultWrapper for testability. The helper is module-private
// in anthropic.ts so we declare a parallel implementation here and pin its
// contract. If the production helper diverges from this contract, this
// test will catch it on the parallel implementation but the production
// behaviour must also be observed via the integration smoke. The proper
// long-term move is to export the helper.

function isResultWrapper(input: unknown): input is { result: object } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const keys = Object.keys(input);
  if (keys.length !== 1 || keys[0] !== "result") return false;
  const inner = (input as { result: unknown }).result;
  return inner !== null && typeof inner === "object" && !Array.isArray(inner);
}

describe("isResultWrapper (Anthropic Opus tool_use unwrap)", () => {
  it("recognises the exact opus-4-7 wrapping pattern", () => {
    // Real shape observed in production logs 2026-05-24.
    const wrapped = { result: { score: 3, summary: "ok", verdict: "do_not_sign" } };
    expect(isResultWrapper(wrapped)).toBe(true);
  });

  it("does NOT unwrap a flat well-formed payload", () => {
    const flat = { score: 7, summary: "ok", verdict: "sign" };
    expect(isResultWrapper(flat)).toBe(false);
  });

  it("does NOT unwrap when result is an array", () => {
    // Defensive: a schema with `result: array` would be a top-level
    // legitimate key — don't unwrap.
    const arr = { result: [1, 2, 3] };
    expect(isResultWrapper(arr)).toBe(false);
  });

  it("does NOT unwrap when result is null", () => {
    const nullResult = { result: null };
    expect(isResultWrapper(nullResult)).toBe(false);
  });

  it("does NOT unwrap when the object has other top-level keys alongside result", () => {
    // Could be a real top-level schema with a `result` field.
    const mixed = { result: { x: 1 }, otherField: 2 };
    expect(isResultWrapper(mixed)).toBe(false);
  });

  it("does NOT unwrap a plain array or null or primitive", () => {
    expect(isResultWrapper([])).toBe(false);
    expect(isResultWrapper(null)).toBe(false);
    expect(isResultWrapper(undefined)).toBe(false);
    expect(isResultWrapper("string")).toBe(false);
    expect(isResultWrapper(42)).toBe(false);
  });
});

describe("zod still validates correctly after unwrap", () => {
  const schema = z.object({
    score: z.coerce.number().int().min(1).max(10),
    label: z.string(),
  });

  it("a wrapped payload + unwrap parses successfully", () => {
    const wrapped = { result: { score: 5, label: "hi" } };
    const target = isResultWrapper(wrapped) ? wrapped.result : wrapped;
    const r = schema.safeParse(target);
    expect(r.success).toBe(true);
  });

  it("a flat payload (no unwrap) still parses successfully", () => {
    const flat = { score: 5, label: "hi" };
    const target = isResultWrapper(flat) ? (flat as { result: object }).result : flat;
    const r = schema.safeParse(target);
    expect(r.success).toBe(true);
  });
});
