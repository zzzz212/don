// Pure helpers extracted from analyze.ts so they can be unit-tested without
// pulling in the AI provider chain.

import type { AnalysisRisk } from "./schemas/analyze";

export const RISK_PRIORITY: Record<AnalysisRisk["level"], number> = {
  critical: 0,
  medium: 1,
  low: 2,
};

export function riskDedupKey(risk: AnalysisRisk): string {
  const original = risk.originalText.trim().slice(0, 50).toLowerCase();
  const number = risk.clauseNumber.trim().toLowerCase();
  return `${number}|${original}`;
}

export function byRiskSeverity(a: AnalysisRisk, b: AnalysisRisk): number {
  return RISK_PRIORITY[a.level] - RISK_PRIORITY[b.level];
}

/**
 * Collapse duplicate risks across chunks. When two entries share a dedup key,
 * keep the higher-severity one (critical wins over medium wins over low).
 */
export function dedupRisks(risks: AnalysisRisk[]): AnalysisRisk[] {
  const seen = new Map<string, AnalysisRisk>();

  for (const risk of risks) {
    const key = riskDedupKey(risk);
    const existing = seen.get(key);

    if (!existing || RISK_PRIORITY[risk.level] < RISK_PRIORITY[existing.level]) {
      seen.set(key, risk);
    }
  }

  return Array.from(seen.values());
}
