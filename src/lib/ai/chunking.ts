// Section-aware splitter for Russian legal contracts.
// Goal: keep semantic units (clauses, sections) intact so a risk is never
// cut across chunks. Uses Russian contract markers (РАЗДЕЛ, СТАТЬЯ, "N.M.")
// as natural boundaries; falls back to paragraph and sentence splits when
// no markers are present.

// Up from 12_000. Sonnet 4.6 (200k context) easily ingests a 50k-char
// contract in one call — and a single-pass analyze costs ≈ 1 model
// invocation, while map-reduce on the same doc costs ≈ N + 1
// invocations (one per chunk + a synthesis). Raising this threshold
// keeps the vast majority of real-world contracts on the cheap path.
// Only true enterprise frame-agreements (50+ pages) hit map-reduce now.
export const SHORT_DOC_THRESHOLD = 50_000;
export const CHUNK_TARGET_SIZE = 20_000;
export const CHUNK_OVERLAP = 800;
export const HARD_DOC_LIMIT = 500_000;

export interface Chunk {
  index: number;
  text: string;
  startChar: number;
  endChar: number;
}

// Markers that indicate the start of a major contract section.
// Matches: "Раздел 5.", "СТАТЬЯ 12", "12. ОБЩИЕ ПОЛОЖЕНИЯ", "Глава III"
const SECTION_REGEX =
  /^(?:\s*)(?:(?:Раздел|РАЗДЕЛ|Статья|СТАТЬЯ|Глава|ГЛАВА)\s+[IVXLC\d]+\.?|\d{1,2}\.\s+[А-ЯЁ][А-ЯЁ\s,«»()\-—]{3,})/m;

function splitBySections(text: string): string[] {
  // Split on section starts but keep the marker with the following content.
  const lines = text.split(/\r?\n/);
  const sections: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (SECTION_REGEX.test(line) && current.length > 0) {
      sections.push(current.join("\n"));
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) sections.push(current.join("\n"));

  return sections.filter((s) => s.trim().length > 0);
}

function splitByParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function splitBySentences(text: string): string[] {
  // Russian sentence end: ".", "!", "?" followed by whitespace + capital letter
  const parts = text.split(/(?<=[.!?])\s+(?=[А-ЯЁA-Z])/);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

// Split a single oversize unit (a section bigger than CHUNK_TARGET_SIZE) into
// pieces that fit. Tries paragraph boundaries first, then sentence boundaries,
// then a hard char split as last resort.
function splitOversize(text: string, maxSize: number): string[] {
  if (text.length <= maxSize) return [text];

  const tryUnits = (units: string[]): string[] | null => {
    if (units.some((u) => u.length > maxSize)) return null;
    const out: string[] = [];
    let buf = "";
    for (const u of units) {
      if (buf.length + u.length + 2 <= maxSize) {
        buf = buf ? `${buf}\n\n${u}` : u;
      } else {
        if (buf) out.push(buf);
        buf = u;
      }
    }
    if (buf) out.push(buf);
    return out;
  };

  const byPara = tryUnits(splitByParagraphs(text));
  if (byPara) return byPara;

  const bySent = tryUnits(splitBySentences(text));
  if (bySent) return bySent;

  // Last resort: hard char-window cut. We try to land on a whitespace.
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + maxSize, text.length);
    if (end < text.length) {
      const ws = text.lastIndexOf(" ", end);
      if (ws > i + maxSize / 2) end = ws;
    }
    out.push(text.slice(i, end));
    i = end;
  }
  return out;
}

// Group sections into chunks under CHUNK_TARGET_SIZE; add overlap between
// adjacent chunks so a clause near the boundary appears in both.
export function chunkContract(
  text: string,
  opts: { targetSize?: number; overlap?: number } = {}
): Chunk[] {
  const targetSize = opts.targetSize ?? CHUNK_TARGET_SIZE;
  const overlap = opts.overlap ?? CHUNK_OVERLAP;

  if (text.length <= SHORT_DOC_THRESHOLD) {
    return [{ index: 0, text, startChar: 0, endChar: text.length }];
  }

  // 1. section split, then explode any oversize section
  let units = splitBySections(text);
  if (units.length === 1) {
    // No section markers found — fall back to paragraph grouping
    units = splitByParagraphs(text);
  }
  units = units.flatMap((u) => splitOversize(u, targetSize));

  // 2. group units into target-sized chunks
  const chunks: Chunk[] = [];
  let buf = "";
  let bufStart = 0;
  let cursor = 0;

  for (const unit of units) {
    const unitStart = text.indexOf(unit, cursor);
    if (unitStart >= 0) cursor = unitStart;

    if (buf.length === 0) {
      buf = unit;
      bufStart = cursor;
    } else if (buf.length + unit.length + 2 <= targetSize) {
      buf = `${buf}\n\n${unit}`;
    } else {
      chunks.push({
        index: chunks.length,
        text: buf,
        startChar: bufStart,
        endChar: bufStart + buf.length,
      });
      buf = unit;
      bufStart = cursor;
    }
    cursor += unit.length;
  }
  if (buf.length > 0) {
    chunks.push({
      index: chunks.length,
      text: buf,
      startChar: bufStart,
      endChar: bufStart + buf.length,
    });
  }

  // 3. add overlap by prepending tail of previous chunk to current
  if (overlap > 0 && chunks.length > 1) {
    for (let i = 1; i < chunks.length; i++) {
      const prev = chunks[i - 1];
      const tail = prev.text.slice(Math.max(0, prev.text.length - overlap));
      chunks[i] = {
        ...chunks[i],
        text: `${tail}\n\n${chunks[i].text}`,
        startChar: Math.max(0, chunks[i].startChar - overlap),
      };
    }
  }

  return chunks;
}

export function isShortDocument(text: string): boolean {
  return text.length <= SHORT_DOC_THRESHOLD;
}

export function isOversizedDocument(text: string): boolean {
  return text.length > HARD_DOC_LIMIT;
}
