// Snaps each analysed risk's `originalText` to the contract's exact
// wording. The model is asked to quote a clause verbatim, but it
// routinely normalises whitespace — collapsing line breaks or double
// spaces. The report's apply-fix does an exact
// `contractText.includes(originalText)` check, so a whitespace-only
// mismatch silently disables the "Применить" button.
//
// This pass finds the real substring whose whitespace-normalised form
// equals the quote's and swaps it in. When there is no match (the model
// paraphrased, or the clause genuinely isn't in the text) the quote is
// left untouched — apply-fix simply stays disabled, exactly as before,
// so this can only ever help, never break a result.

import type { AnalysisRisk } from "./schemas/analyze";

// Quotes shorter than this are skipped: too short to anchor safely, and
// usually placeholders ("—", "Пункт отсутствует") rather than real cites.
const MIN_QUOTE_LENGTH = 20;

/** A whitespace-collapsed copy of `text`, plus a map from each
 *  normalised char index back to its index in the original string. */
function normalizeWithMap(text: string): {
  normalized: string;
  map: number[];
} {
  let normalized = "";
  const map: number[] = [];
  let prevSpace = false;
  for (let i = 0; i < text.length; i++) {
    const isSpace = /\s/.test(text[i]);
    if (isSpace) {
      if (prevSpace) continue; // collapse runs of whitespace
      normalized += " ";
      map.push(i);
      prevSpace = true;
    } else {
      normalized += text[i];
      map.push(i);
      prevSpace = false;
    }
  }
  return { normalized, map };
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** The exact substring of `contractText` whose whitespace-normalised
 *  form equals `quote`'s. Returns `quote` itself when it already matches
 *  verbatim, and null when there is no whitespace-only match. */
export function findVerbatimQuote(
  contractText: string,
  quote: string
): string | null {
  if (contractText.includes(quote)) return quote;

  const needle = collapse(quote);
  if (needle.length < MIN_QUOTE_LENGTH) return null;

  const { normalized, map } = normalizeWithMap(contractText);
  const at = normalized.indexOf(needle);
  if (at < 0) return null;

  const start = map[at];
  // needle is trimmed, so its last char is non-space and maps to a
  // single original char — +1 makes the slice end exclusive.
  const end = map[at + needle.length - 1] + 1;
  return contractText.slice(start, end);
}

/** Repair `originalText` on each risk so the report's apply-fix can
 *  match it. Risks whose quote can't be located are returned unchanged. */
export function verifyRiskQuotes(
  contractText: string,
  risks: AnalysisRisk[]
): AnalysisRisk[] {
  return risks.map((risk) => {
    const quote = risk.originalText;
    if (!quote || quote.trim().length < MIN_QUOTE_LENGTH) return risk;
    const snapped = findVerbatimQuote(contractText, quote);
    if (snapped && snapped !== quote) {
      return { ...risk, originalText: snapped };
    }
    return risk;
  });
}
