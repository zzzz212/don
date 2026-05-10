// Patch operations for AI-driven document refinement.
//
// The AI-refine endpoint can either regenerate the whole document (slow,
// expensive — every refine costs N output tokens where N is doc length)
// or describe its changes as a small set of structured operations. This
// module implements the latter.
//
// The contract: each operation locates a substring in the source document
// (the "anchor") via plain indexOf and applies a transform. If any anchor
// can't be found, the entire patch is rejected and the route falls back
// to the full-regen path. We never apply a partial patch — silent partial
// success is much worse than a clean failure.
//
// Why indexOf and not a fuzzy match: for legal documents, character-perfect
// anchoring is the right call. A fuzzy match could replace the wrong clause
// (multiple "Подрядчик обязуется" lines exist) and the user wouldn't
// notice until they signed the contract.

export type RefineOperation =
  | {
      op: "replace";
      /** Exact substring of the source to replace. Must occur exactly once. */
      find: string;
      /** Replacement text. May be empty (effectively a delete). */
      replace: string;
    }
  | {
      op: "insert_after";
      /** Anchor that must already be in the source. */
      anchor: string;
      /** Text to insert immediately after the anchor (preceded by \n\n). */
      text: string;
    }
  | {
      op: "insert_before";
      anchor: string;
      /** Text to insert immediately before the anchor (followed by \n\n). */
      text: string;
    }
  | {
      op: "delete";
      /** Exact substring of the source to delete. */
      find: string;
    };

export interface PatchSuccess {
  ok: true;
  result: string;
  /** Per-op summary in the order applied — used for the changesSummary. */
  appliedOps: Array<{ op: RefineOperation["op"]; preview: string }>;
}

export interface PatchFailure {
  ok: false;
  /** Which op failed (1-based) and why. */
  failedAt: number;
  reason: string;
  /** Full op that failed, for telemetry — never sent to the user. */
  failedOp: RefineOperation;
}

/**
 * Apply a list of refine operations to the source document. Returns the
 * patched result on success or a structured failure pointing at the bad
 * operation. Never throws.
 *
 * Each anchor must be unique in the source — if "Подрядчик обязуется"
 * appears twice, the patch refuses (we don't know which one the AI
 * meant). The AI is instructed to widen the anchor if the short form
 * isn't unique, e.g. "5.2. Подрядчик обязуется".
 *
 * Operations apply sequentially so subsequent anchors must match the
 * progressively-patched intermediate state, not the original source.
 */
export function applyRefinePatch(
  source: string,
  ops: RefineOperation[]
): PatchSuccess | PatchFailure {
  if (ops.length === 0) {
    return {
      ok: false,
      failedAt: 0,
      reason: "Список операций пуст.",
      failedOp: { op: "delete", find: "" },
    };
  }

  let current = source;
  const appliedOps: PatchSuccess["appliedOps"] = [];

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const result = applyOne(current, op);
    if (!result.ok) {
      return {
        ok: false,
        failedAt: i + 1,
        reason: result.reason,
        failedOp: op,
      };
    }
    current = result.next;
    appliedOps.push({ op: op.op, preview: previewOp(op) });
  }

  return { ok: true, result: current, appliedOps };
}

function applyOne(
  current: string,
  op: RefineOperation
): { ok: true; next: string } | { ok: false; reason: string } {
  // Normalise anchor whitespace at the boundaries so a stray newline in
  // the AI output doesn't break the match. Internal whitespace stays as-is.
  switch (op.op) {
    case "replace": {
      const find = op.find.trim();
      const occurrences = countOccurrences(current, find);
      if (occurrences === 0) {
        return {
          ok: false,
          reason: `Якорь не найден в документе: «${preview(find)}»`,
        };
      }
      if (occurrences > 1) {
        return {
          ok: false,
          reason: `Якорь встречается ${occurrences} раз — уточните формулировку: «${preview(find)}»`,
        };
      }
      const idx = current.indexOf(find);
      const next =
        current.slice(0, idx) + op.replace + current.slice(idx + find.length);
      return { ok: true, next };
    }

    case "delete": {
      const find = op.find.trim();
      const occurrences = countOccurrences(current, find);
      if (occurrences === 0) {
        return {
          ok: false,
          reason: `Текст для удаления не найден: «${preview(find)}»`,
        };
      }
      if (occurrences > 1) {
        return {
          ok: false,
          reason: `Текст для удаления встречается ${occurrences} раз — уточните формулировку`,
        };
      }
      const idx = current.indexOf(find);
      // Trim a single trailing newline to avoid leaving a double-blank gap.
      let endTrim = idx + find.length;
      if (current[endTrim] === "\n") endTrim++;
      const next = current.slice(0, idx) + current.slice(endTrim);
      return { ok: true, next };
    }

    case "insert_after": {
      const anchor = op.anchor.trim();
      const occurrences = countOccurrences(current, anchor);
      if (occurrences === 0) {
        return {
          ok: false,
          reason: `Якорь не найден: «${preview(anchor)}»`,
        };
      }
      if (occurrences > 1) {
        return {
          ok: false,
          reason: `Якорь встречается ${occurrences} раз — уточните формулировку`,
        };
      }
      const idx = current.indexOf(anchor);
      const insertAt = idx + anchor.length;
      const next =
        current.slice(0, insertAt) +
        "\n\n" +
        op.text.trim() +
        current.slice(insertAt);
      return { ok: true, next };
    }

    case "insert_before": {
      const anchor = op.anchor.trim();
      const occurrences = countOccurrences(current, anchor);
      if (occurrences === 0) {
        return {
          ok: false,
          reason: `Якорь не найден: «${preview(anchor)}»`,
        };
      }
      if (occurrences > 1) {
        return {
          ok: false,
          reason: `Якорь встречается ${occurrences} раз — уточните формулировку`,
        };
      }
      const idx = current.indexOf(anchor);
      const next =
        current.slice(0, idx) + op.text.trim() + "\n\n" + current.slice(idx);
      return { ok: true, next };
    }
  }
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  while (true) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) return count;
    count++;
    from = idx + needle.length;
  }
}

function preview(s: string): string {
  const trimmed = s.trim().replace(/\s+/g, " ");
  return trimmed.length <= 60 ? trimmed : `${trimmed.slice(0, 57)}…`;
}

function previewOp(op: RefineOperation): string {
  switch (op.op) {
    case "replace":
      return `заменено «${preview(op.find)}»`;
    case "delete":
      return `удалено «${preview(op.find)}»`;
    case "insert_after":
      return `вставлено после «${preview(op.anchor)}»`;
    case "insert_before":
      return `вставлено перед «${preview(op.anchor)}»`;
  }
}

/**
 * Heuristic to decide whether the patch path is worth trying for a given
 * (source, ops) pair. If the AI returned ops whose combined output text
 * approaches the size of the source, we save very little — better to just
 * let the regen path stream a fresh document. Threshold tuned at 60% so
 * tiny edits go fast, big rewrites bypass.
 */
export function patchSizeRatio(
  source: string,
  ops: RefineOperation[]
): number {
  if (source.length === 0) return 1;
  const outputChars = ops.reduce((sum, op) => {
    if (op.op === "replace") return sum + op.replace.length;
    if (op.op === "insert_after" || op.op === "insert_before")
      return sum + op.text.length;
    return sum;
  }, 0);
  return outputChars / source.length;
}
