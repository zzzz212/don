interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  lineNumber: number;
}

interface DiffResult {
  added: number;
  removed: number;
  changed: number;
  lines: DiffLine[];
}

export function computeDiff(oldText: string, newText: string): DiffResult {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  const lines: DiffLine[] = [];
  let added = 0;
  let removed = 0;
  let changed = 0;

  const maxLength = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLength; i++) {
    const oldLine = oldLines[i] || "";
    const newLine = newLines[i] || "";

    if (oldLine === newLine) {
      lines.push({
        type: "unchanged",
        content: newLine,
        lineNumber: i + 1,
      });
    } else if (!oldLine && newLine) {
      lines.push({
        type: "added",
        content: newLine,
        lineNumber: i + 1,
      });
      added++;
    } else if (oldLine && !newLine) {
      lines.push({
        type: "removed",
        content: oldLine,
        lineNumber: i + 1,
      });
      removed++;
    } else {
      // Line changed
      lines.push({
        type: "removed",
        content: oldLine,
        lineNumber: i + 1,
      });
      lines.push({
        type: "added",
        content: newLine,
        lineNumber: i + 1,
      });
      changed++;
    }
  }

  return {
    added,
    removed,
    changed,
    lines,
  };
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
