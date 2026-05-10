import { describe, it, expect } from "vitest";
import { computeDiff, generateDiffSummary } from "../diff";

describe("computeDiff", () => {
  it("returns no hunks of change for identical inputs", () => {
    const r = computeDiff("a\nb\nc", "a\nb\nc");
    expect(r.added).toBe(0);
    expect(r.removed).toBe(0);
    expect(r.changed).toBe(0);
    expect(r.hunks.every((h) => h.type === "context")).toBe(true);
  });

  it("recognises a pure addition", () => {
    const r = computeDiff("a\nb", "a\nb\nc");
    expect(r.added).toBe(1);
    expect(r.removed).toBe(0);
    expect(r.changed).toBe(0);
    const addedHunk = r.hunks.find((h) => h.type === "added");
    expect(addedHunk).toBeDefined();
    expect(addedHunk?.type === "added" && addedHunk.content).toBe("c");
  });

  it("recognises a pure removal", () => {
    const r = computeDiff("a\nb\nc", "a\nc");
    expect(r.removed).toBe(1);
    expect(r.added).toBe(0);
  });

  it("does NOT mistake an inserted line for cascading line changes", () => {
    // The naive "i-th old vs i-th new" diff would mark every line after
    // the insert as 'changed'. Myers-based diff correctly aligns and
    // marks only the new line as added.
    const oldText = "header\nbody\nfooter";
    const newText = "header\nNEW LINE\nbody\nfooter";
    const r = computeDiff(oldText, newText);
    expect(r.added).toBe(1);
    expect(r.removed).toBe(0);
    expect(r.changed).toBe(0);
  });

  it("coalesces single-line replace into a 'modified' hunk with word tokens", () => {
    const r = computeDiff("Срок 12 месяцев.", "Срок 24 месяца.");
    expect(r.changed).toBe(1);
    expect(r.added).toBe(0);
    expect(r.removed).toBe(0);
    const mod = r.hunks.find((h) => h.type === "modified");
    expect(mod).toBeDefined();
    if (mod && mod.type === "modified") {
      // Old should have a 'removed' token for "12" and one for "месяцев."
      const removedTexts = mod.oldTokens
        .filter((t) => t.type === "removed")
        .map((t) => t.text);
      expect(removedTexts.some((t) => t.includes("12"))).toBe(true);
      // New should have an 'added' token for "24"
      const addedTexts = mod.newTokens
        .filter((t) => t.type === "added")
        .map((t) => t.text);
      expect(addedTexts.some((t) => t.includes("24"))).toBe(true);
    }
  });

  it("preserves line numbers for hunks", () => {
    const r = computeDiff("a\nb\nc", "a\nB\nc");
    const mod = r.hunks.find((h) => h.type === "modified");
    expect(mod).toBeDefined();
    if (mod && mod.type === "modified") {
      expect(mod.oldLineNumber).toBe(2);
      expect(mod.newLineNumber).toBe(2);
    }
  });

  it("handles empty inputs", () => {
    // "".split("\n") → [""] (one empty line), not zero lines, so an
    // empty → non-empty single-line replace is reported as "modified"
    // (the empty line gets replaced) rather than "added". Same logic
    // in reverse for non-empty → empty.
    const r = computeDiff("", "hello");
    expect(r.changed).toBe(1);
    expect(r.added).toBe(0);
    expect(r.removed).toBe(0);
    const r2 = computeDiff("hello", "");
    expect(r2.changed).toBe(1);
  });
});

describe("generateDiffSummary", () => {
  it("reports 'no changes' when texts match", () => {
    expect(generateDiffSummary("x", "x")).toContain("нет");
  });

  it("counts modifications as 'changed'", () => {
    expect(generateDiffSummary("a", "b")).toContain("изменено");
  });
});
