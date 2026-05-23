// Diff between two versions of a generated document. The naive
// "line-i in old vs line-i in new" approach we used to ship was
// useless once any line was inserted or deleted at the top — every
// subsequent line drifted and showed as "changed".
//
// Now backed by the `diff` npm package: line-level alignment via
// diffArrays (each line becomes one array item, no clever newline
// handling needed) plus a word-level secondary diff inside modified
// hunks so the UI can highlight exactly which words changed.

import { diffArrays, diffWordsWithSpace } from "diff";

export type WordToken = {
  type: "context" | "removed" | "added";
  text: string;
};

export type DiffHunk =
  | {
      type: "context";
      content: string;
      oldLineNumber: number;
      newLineNumber: number;
    }
  | {
      type: "removed";
      content: string;
      oldLineNumber: number;
    }
  | {
      type: "added";
      content: string;
      newLineNumber: number;
    }
  | {
      type: "modified";
      oldContent: string;
      newContent: string;
      oldLineNumber: number;
      newLineNumber: number;
      oldTokens: WordToken[];
      newTokens: WordToken[];
    };

export interface DiffResult {
  added: number;
  removed: number;
  changed: number;
  hunks: DiffHunk[];
}

/**
 * Compute a structured diff between two document texts. Lines aligned
 * via Myers; pairs of (removed,added) within the same change region
 * are coalesced into "modified" hunks with a word-level breakdown.
 */
export function computeDiff(oldText: string, newText: string): DiffResult {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const parts = diffArrays(oldLines, newLines);

  const hunks: DiffHunk[] = [];
  let added = 0;
  let removed = 0;
  let changed = 0;

  let oldLineNumber = 1;
  let newLineNumber = 1;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const next = parts[i + 1];

    // Coalesce a single-line removed + single-line added pair into a
    // "modified" hunk so the UI can show inline word-level highlights.
    // Multi-line groups stay as separate add/remove hunks because
    // there's no good 1:1 alignment without a slow second-pass match.
    if (
      part.removed &&
      next?.added &&
      part.value.length === 1 &&
      next.value.length === 1
    ) {
      const oldLine = part.value[0];
      const newLine = next.value[0];
      const wordParts = diffWordsWithSpace(oldLine, newLine);
      const oldTokens: WordToken[] = [];
      const newTokens: WordToken[] = [];
      for (const w of wordParts) {
        if (w.added) {
          newTokens.push({ type: "added", text: w.value });
        } else if (w.removed) {
          oldTokens.push({ type: "removed", text: w.value });
        } else {
          oldTokens.push({ type: "context", text: w.value });
          newTokens.push({ type: "context", text: w.value });
        }
      }
      hunks.push({
        type: "modified",
        oldContent: oldLine,
        newContent: newLine,
        oldLineNumber,
        newLineNumber,
        oldTokens,
        newTokens,
      });
      oldLineNumber++;
      newLineNumber++;
      changed++;
      i++; // consume the paired "added" part
      continue;
    }

    if (part.added) {
      for (const line of part.value) {
        hunks.push({
          type: "added",
          content: line,
          newLineNumber,
        });
        newLineNumber++;
        added++;
      }
    } else if (part.removed) {
      for (const line of part.value) {
        hunks.push({
          type: "removed",
          content: line,
          oldLineNumber,
        });
        oldLineNumber++;
        removed++;
      }
    } else {
      for (const line of part.value) {
        hunks.push({
          type: "context",
          content: line,
          oldLineNumber,
          newLineNumber,
        });
        oldLineNumber++;
        newLineNumber++;
      }
    }
  }

  return { added, removed, changed, hunks };
}

export function generateDiffSummary(
  oldText: string,
  newText: string
): string {
  const diff = computeDiff(oldText, newText);

  if (diff.added === 0 && diff.removed === 0 && diff.changed === 0) {
    return "Изменений нет";
  }

  const parts: string[] = [];

  if (diff.added > 0) {
    parts.push(`добавлено ${diff.added} строк`);
  }
  if (diff.removed > 0) {
    parts.push(`удалено ${diff.removed} строк`);
  }
  if (diff.changed > 0) {
    parts.push(`изменено ${diff.changed} строк`);
  }

  return parts.join(", ");
}
