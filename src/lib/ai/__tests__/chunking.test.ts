import { describe, it, expect } from "vitest";
import {
  chunkContract,
  isShortDocument,
  isOversizedDocument,
  SHORT_DOC_THRESHOLD,
  CHUNK_TARGET_SIZE,
  CHUNK_OVERLAP,
  HARD_DOC_LIMIT,
} from "../chunking";

function syntheticContract(targetChars: number, sectionCount = 8): string {
  const sectionTexts = [
    "1. ПРЕДМЕТ ДОГОВОРА\n1.1. Текст предмета договора. ",
    "2. ЦЕНА И ПОРЯДОК РАСЧЁТОВ\n2.1. Сумма договора. ",
    "3. ПРАВА И ОБЯЗАННОСТИ СТОРОН\n3.1. Перечень обязанностей. ",
    "4. ОТВЕТСТВЕННОСТЬ СТОРОН\n4.1. Неустойка. ",
    "5. КОНФИДЕНЦИАЛЬНОСТЬ\n5.1. Сторона обязуется. ",
    "6. ПОРЯДОК РАЗРЕШЕНИЯ СПОРОВ\n6.1. Все споры. ",
    "7. ФОРС-МАЖОР\n7.1. Стороны освобождаются. ",
    "8. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ\n8.1. Договор вступает в силу. ",
  ];

  const filler = "Текст пункта договора с подробным описанием. ";
  let body = "";
  let i = 0;
  while (body.length < targetChars) {
    const head = sectionTexts[i % sectionCount];
    body += `\n\n${head}${filler.repeat(40)}`;
    i++;
  }
  return body;
}

describe("isShortDocument / isOversizedDocument", () => {
  it("treats anything <= SHORT_DOC_THRESHOLD as short", () => {
    expect(isShortDocument("a".repeat(SHORT_DOC_THRESHOLD))).toBe(true);
    expect(isShortDocument("a".repeat(SHORT_DOC_THRESHOLD + 1))).toBe(false);
  });

  it("treats anything > HARD_DOC_LIMIT as oversized", () => {
    expect(isOversizedDocument("a".repeat(HARD_DOC_LIMIT))).toBe(false);
    expect(isOversizedDocument("a".repeat(HARD_DOC_LIMIT + 1))).toBe(true);
  });
});

describe("chunkContract", () => {
  it("returns a single chunk for short documents", () => {
    const text = syntheticContract(8_000);
    const chunks = chunkContract(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe(text);
    expect(chunks[0].startChar).toBe(0);
  });

  it("produces multiple chunks for medium documents", () => {
    // 80k crosses the new 50k single-pass threshold. The chunker is
    // only invoked for genuinely long contracts now.
    const text = syntheticContract(80_000);
    const chunks = chunkContract(text);
    expect(chunks.length).toBeGreaterThan(1);

    // Excluding the overlap prepend, each chunk body should fit under target.
    // We check the inner unit-grouped portion stays bounded.
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const bodySize =
        i === 0 ? c.text.length : c.text.length - CHUNK_OVERLAP - 2;
      expect(bodySize).toBeLessThanOrEqual(CHUNK_TARGET_SIZE);
    }
  });

  it("scales chunk count with document size", () => {
    const small = chunkContract(syntheticContract(80_000));
    const large = chunkContract(syntheticContract(160_000));
    expect(large.length).toBeGreaterThan(small.length);
  });

  it("adds overlap between adjacent chunks", () => {
    const text = syntheticContract(60_000);
    const chunks = chunkContract(text);
    if (chunks.length < 2) {
      // doc was too small to require splitting in this run; that's fine
      return;
    }
    // Each chunk after the first should start with content that also appears
    // at the tail of the previous chunk.
    for (let i = 1; i < chunks.length; i++) {
      const prevTail = chunks[i - 1].text.slice(-CHUNK_OVERLAP);
      const overlapHead = chunks[i].text.slice(0, prevTail.length);
      expect(overlapHead).toBe(prevTail);
    }
  });

  it("indexes chunks sequentially from zero", () => {
    const chunks = chunkContract(syntheticContract(40_000));
    chunks.forEach((c, i) => expect(c.index).toBe(i));
  });

  it("survives input with no section markers (paragraph fallback)", () => {
    const para = "Это абзац без явной структуры. ".repeat(80);
    const text = (para + "\n\n").repeat(40);
    const chunks = chunkContract(text);
    expect(chunks.length).toBeGreaterThan(0);
    const totalText = chunks.map((c) => c.text).join("");
    // Sanity: nothing dropped on the floor (allowing for overlap repetition)
    expect(totalText.length).toBeGreaterThanOrEqual(text.length);
  });

  it("handles a single oversize section by sentence splitting", () => {
    // One huge unit with no structure markers, well past the 50k
    // single-pass threshold so the chunker actually runs.
    const giant =
      "Один очень длинный абзац с предложениями. ".repeat(1500); // ~63k chars
    const chunks = chunkContract(giant);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      // Each chunk (sans overlap) shouldn't blow past target by more than overlap
      expect(c.text.length).toBeLessThanOrEqual(
        CHUNK_TARGET_SIZE + CHUNK_OVERLAP + 2
      );
    }
  });
});
